import type { Env } from "@shared/env";
import { getProvider, AIDataUnavailableError } from "../ai/provider";
import { rrfFuse } from "../retrieval/rrf";
import { embedTexts } from "../retrieval/indexer";
import { tokenizeQuery } from "@shared/cjk";
import {
  buildChatMessages,
  classifyIntent,
  greetingReply,
  noAnswerReply,
  extractiveReply,
  emergencyReply,
} from "./prompts";

export interface ChatMessageRow {
  id: number;
  role: "user" | "assistant";
  content: string;
}

async function persistMessage(
  env: Env,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)`,
  )
    .bind(sessionId, role, content)
    .run();
}

/**
 * 混合检索:FTS5 词面(写入时预分词,D1 原生 bm25() 排序)
 * + Vectorize 语义 → RRF 融合 topK。
 * 不在 Worker 内构建内存索引(免费版 10ms CPU 限制)。
 */
export async function retrieveCsKb(
  env: Env,
  query: string,
  topK = 4,
): Promise<{ title: string; text: string }[]> {
  // 词面路:FTS5 MATCH(查询侧二元组,OR 组合),标题列 8 倍 bm25 加权
  const ftsIds: string[] = [];
  const qTokens = tokenizeQuery(query).slice(0, 24);
  if (qTokens.length > 0) {
    const match = qTokens.map((t) => `"${t}"`).join(" OR ");
    try {
      const { results } = await env.DB.prepare(
        `SELECT c.id FROM cs_chunks_fts f
         JOIN cs_chunks c ON c.id = f.rowid
         JOIN cs_articles a ON a.id = c.article_id
         WHERE cs_chunks_fts MATCH ? AND a.enabled = 1
         ORDER BY bm25(cs_chunks_fts, 8.0, 1.0) LIMIT 12`,
      )
        .bind(match)
        .all<{ id: number }>();
      ftsIds.push(...(results ?? []).map((r) => `cs-${r.id}`));
    } catch (e) {
      console.error("fts query failed:", e);
    }
  }

  // 语义路:query embedding → Vectorize cs 命名空间
  const vecIds: string[] = [];
  const vectors = await embedTexts(env, [query]);
  if (vectors && env.VEC) {
    try {
      const res = await env.VEC.query(vectors[0], {
        topK: 8,
        namespace: "cs",
        returnMetadata: "none",
      });
      vecIds.push(...res.matches.map((m) => m.id));
    } catch (e) {
      console.error("vector query failed:", e);
    }
  }

  if (ftsIds.length === 0 && vecIds.length === 0) return [];

  // RRF 融合后取 chunk 正文
  const fused = rrfFuse([ftsIds, vecIds]).slice(0, topK);
  const ids = fused.map((f) => Number(f.id.replace("cs-", "")));
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const { results: chunks } = await env.DB.prepare(
    `SELECT id, title, chunk_text FROM cs_chunks WHERE id IN (${placeholders})`,
  )
    .bind(...ids)
    .all<{ id: number; title: string; chunk_text: string }>();
  const byId = new Map((chunks ?? []).map((r) => [r.id, r]));
  return fused
    .map((f) => byId.get(Number(f.id.replace("cs-", ""))))
    .filter((c): c is { id: number; title: string; chunk_text: string } =>
      Boolean(c),
    )
    .map((c) => ({ title: c.title, text: c.chunk_text }));
}

function sseResponse(handler: (send: SendEvent) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: SendEvent = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await handler(send);
      } catch (e) {
        console.error("chat stream error:", e);
        try {
          send({ type: "fallback", text: emergencyReply() });
          send({ type: "done" });
        } catch {
          /* controller 已关闭 */
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Content-Encoding": "identity",
    },
  });
}

export type SendEvent = (event: ChatStreamEvent) => void;

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "fallback"; text: string }
  | { type: "done" };

/**
 * 处理一次客服对话,返回 SSE Response。
 * 链路:历史 → 意图路由 → 混合检索 → LLM 流式 → 三级兜底 → 落库。
 */
export function handleChat(env: Env, sessionId: string, message: string): Response {
  return sseResponse(async (send) => {
    const history = (
      await env.DB.prepare(
        `SELECT role, content FROM chat_messages
         WHERE session_id = ? ORDER BY id DESC LIMIT 8`,
      )
        .bind(sessionId)
        .all<{ role: "user" | "assistant"; content: string }>()
    ).results?.reverse() ?? [];

    await persistMessage(env, sessionId, "user", message);

    // ① 意图路由:问候/致谢模板直答
    if (classifyIntent(message) === "greeting") {
      const reply = greetingReply(message);
      send({ type: "delta", text: reply });
      send({ type: "done" });
      await persistMessage(env, sessionId, "assistant", reply);
      return;
    }

    // ② 混合检索
    let hits: { title: string; text: string }[] = [];
    try {
      hits = await retrieveCsKb(env, message, 4);
    } catch (e) {
      console.error("kb retrieve failed:", e);
    }

    // ③ KB 无命中:礼貌兜底(不调 LLM,不编造)
    if (hits.length === 0) {
      const reply = noAnswerReply();
      send({ type: "delta", text: reply });
      send({ type: "done" });
      await persistMessage(env, sessionId, "assistant", reply);
      return;
    }

    // ④ LLM 流式生成
    const messages = buildChatMessages({ history, message, kbHits: hits });
    let full = "";
    try {
      const provider = getProvider(env);
      const iter = await provider.generateStream(messages, {
        maxTokens: 1500,
        temperature: 0.5,
      });
      for await (const delta of iter) {
        full += delta;
        send({ type: "delta", text: delta });
      }
    } catch (e) {
      console.error("llm stream failed:", e);
      if (e instanceof AIDataUnavailableError) {
        const reply = extractiveReply(hits);
        send({ type: "fallback", text: reply });
        await persistMessage(env, sessionId, "assistant", reply);
        send({ type: "done" });
        return;
      }
    }

    // ⑤ LLM 失败/空输出 → 抽取式兜底;成功 → 落库
    if (!full.trim()) {
      const reply = extractiveReply(hits);
      send({ type: "fallback", text: reply });
      await persistMessage(env, sessionId, "assistant", reply);
      send({ type: "done" });
      return;
    }
    send({ type: "done" });
    await persistMessage(env, sessionId, "assistant", full.trim());
  });
}
