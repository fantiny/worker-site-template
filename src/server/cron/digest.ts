import type { Env } from "@shared/env";
import { parseFeed, type FeedItem } from "../rss/parse";
import { getProvider, stripThink } from "../ai/provider";

const MAX_SOURCES = 10;
const MAX_ITEMS_PER_SOURCE = 15;
// LLM 详摘条数:推理模型 token 预算有限,40 条会导致只摘一半
const MAX_ITEMS_FOR_LLM = 20;
const FETCH_TIMEOUT_MS = 12000;

/** 北京时间(UTC+8)的当天日期 */
export function beijingDate(now = Date.now()): string {
  return new Date(now + 8 * 3600_000).toISOString().slice(0, 10);
}

async function urlHash(url: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(url),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchFeed(url: string): Promise<FeedItem[]> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "personal-ai-hub/0.1 (+https://workers.dev)" },
  });
  if (!res.ok) throw new Error(`feed ${url} -> ${res.status}`);
  const xml = await res.text();
  return parseFeed(xml).items;
}

interface CollectedItem {
  source: string;
  title: string;
  url: string;
  urlHash: string;
  summary: string;
  publishedAt: string | null;
}

/** 组装 LLM 摘要请求的 user 消息 */
export function buildDigestUserMessage(
  items: { index: number; source: string; title: string; summary: string }[],
): string {
  return [
    "资讯列表:",
    ...items.map(
      (it) =>
        `${it.index}. [${it.source}] ${it.title}\n   原文摘要:${it.summary.slice(0, 200) || "(无)"}`,
    ),
  ].join("\n");
}

/** 从 LLM 输出中稳健解析 JSON(容忍代码围栏与前后杂文) */
export function parseDigestJson(text: string): {
  items: { i: number; summary: string }[];
  digest: string;
} | null {
  const cleaned = stripThink(text)
    .replace(/^```(?:json)?/m, "")
    .replace(/```$/m, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as {
      items?: { i?: number; summary?: string }[];
      digest?: string;
    };
    if (!Array.isArray(obj.items) || typeof obj.digest !== "string") return null;
    return {
      items: obj.items
        .filter((it) => typeof it.i === "number" && typeof it.summary === "string")
        .map((it) => ({ i: it.i as number, summary: it.summary as string })),
      digest: obj.digest,
    };
  } catch {
    return null;
  }
}

export interface DigestResult {
  date: string;
  sourcesFetched: number;
  inserted: number;
  llmUsed: boolean;
}

/** 日报流水线:抓取 → 去重入库 → LLM 摘要 + 综述 → 写日报 */
export async function runDigest(env: Env): Promise<DigestResult> {
  const date = beijingDate();
  const sources = (
    await env.DB.prepare(
      `SELECT id, name, url FROM feed_sources WHERE enabled = 1 ORDER BY id LIMIT ?`,
    )
      .bind(MAX_SOURCES)
      .all<{ id: number; name: string; url: string }>()
  ).results ?? [];

  // 抓取(单源失败跳过不中断)
  const collected: CollectedItem[] = [];
  let sourcesFetched = 0;
  for (const src of sources) {
    try {
      const items = await fetchFeed(src.url);
      sourcesFetched++;
      for (const item of items.slice(0, MAX_ITEMS_PER_SOURCE)) {
        if (!item.title || !item.link) continue;
        collected.push({
          source: src.name,
          title: item.title.slice(0, 300),
          url: item.link,
          urlHash: await urlHash(item.link),
          summary: item.summary,
          publishedAt: item.publishedAt,
        });
      }
    } catch (e) {
      console.error(`feed source failed: ${src.name}`, e);
    }
  }

  // 当日去重入库
  const inserted: CollectedItem[] = [];
  for (const item of collected) {
    const exists = await env.DB.prepare(
      `SELECT 1 FROM news_items WHERE digest_date = ? AND url_hash = ?`,
    )
      .bind(date, item.urlHash)
      .first();
    if (exists) continue;
    await env.DB.prepare(
      `INSERT INTO news_items (digest_date, source, title, url, url_hash, original_summary, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        date,
        item.source,
        item.title,
        item.url,
        item.urlHash,
        item.summary,
        item.publishedAt,
      )
      .run();
    inserted.push(item);
  }

  // 当天没有任何新条目时,保留已有日报(AI 综述),不做覆盖
  if (inserted.length === 0) {
    return { date, sourcesFetched, inserted: 0, llmUsed: false };
  }

  // LLM 摘要 + 综述(无 AI 时退化为原文摘要 + 标题列表)
  let llmUsed = false;
  const forLlm = inserted.slice(0, MAX_ITEMS_FOR_LLM);
  const idByIndex = new Map<number, string>(); // index -> url_hash
  let summaryMd = "";

  if (env.AI && forLlm.length > 0) {
    try {
      const numbered = forLlm.map((it, idx) => ({
        index: idx + 1,
        source: it.source,
        title: it.title,
        summary: it.summary,
        id: it.urlHash,
      }));
      const provider = getProvider(env);
      const raw = await provider.generate(
        [
          {
            role: "system",
            content: [
              "你是 AI 资讯编辑。根据给定的资讯列表(标题+原文摘要),只输出一个 JSON 对象,格式:",
              '{"items":[{"i":序号,"summary":"不超过60字的简体中文摘要,保留关键事实"}],"digest":"今日综述,markdown,结构固定为:"}',
              "",
              "digest 的结构(严格遵守):",
              "1. 第一行:一句话总览,不超过 40 字,概括今天最重要的趋势,不要加标题前缀;",
              "2. 空一行后输出 3-5 条要点,每条一行,格式:- **小标题(8字内)**:一句话解释,按重要性排序;",
              "3. 不要输出 JSON 以外的任何文字,不要输出二级标题。",
            ].join("\n"),
          },
          { role: "user", content: buildDigestUserMessage(numbered) },
        ],
        { maxTokens: 4096, temperature: 0.3 },
      );
      const parsed = parseDigestJson(raw);
      if (parsed) {
        llmUsed = true;
        summaryMd = parsed.digest;
        for (const it of parsed.items) {
          const target = numbered[it.i - 1];
          if (!target) continue;
          idByIndex.set(it.i, target.id);
          await env.DB.prepare(
            `UPDATE news_items SET ai_summary = ? WHERE digest_date = ? AND url_hash = ?`,
          )
            .bind(it.summary, date, target.id)
            .run();
        }
      }
    } catch (e) {
      console.error("digest llm failed:", e);
    }
  }

  // 未被 LLM 覆盖的条目(或 LLM 失败)用原文摘要补位,保证日报每条都有可读摘要
  for (const it of inserted) {
    await env.DB.prepare(
      `UPDATE news_items SET ai_summary = ? WHERE digest_date = ? AND url_hash = ? AND (ai_summary = '' OR ai_summary IS NULL)`,
    )
      .bind(it.summary.slice(0, 160), date, it.urlHash)
      .run();
  }

  if (!llmUsed) {
    // 无 AI / 解析失败:综述退化为标题列表
    summaryMd =
      inserted
        .slice(0, MAX_ITEMS_FOR_LLM)
        .map((it) => `- [${it.source}] ${it.title}`)
        .join("\n") || "今日没有抓取到新资讯。";
  }

  await env.DB.prepare(
    `INSERT INTO daily_digests (digest_date, summary_md, model, item_count)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(digest_date) DO UPDATE SET
       summary_md = excluded.summary_md, model = excluded.model, item_count = excluded.item_count`,
  )
    .bind(
      date,
      summaryMd,
      llmUsed ? env.AI_TEXT_MODEL || "workers-ai" : "fallback",
      inserted.length,
    )
    .run();

  return { date, sourcesFetched, inserted: inserted.length, llmUsed };
}
