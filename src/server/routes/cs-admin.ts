import { Hono } from "hono";
import type { Env } from "@shared/env";
import { requireAdmin } from "../auth";
import {
  chunkAndStoreArticle,
  syncArticleVectors,
  rebuildFts,
  reindexAllCsArticles,
} from "../cs/kb";

interface CsArticleRow {
  id: number;
  title: string;
  content_md: string;
  enabled: number;
  updated_at: string;
  chunk_count?: number;
}

/** 保存一篇文章:更新行 → 重分块 → 向量同步 → bump 版本 */
async function saveArticle(
  env: Env,
  id: number,
  title: string,
  contentMd: string,
): Promise<void> {
  const oldIds =
    (
      await env.DB.prepare(
        `SELECT id FROM cs_chunks WHERE article_id = ?`,
      )
        .bind(id)
        .all<{ id: number }>()
    ).results?.map((r) => r.id) ?? [];
  await chunkAndStoreArticle(env, id, title, contentMd);
  await syncArticleVectors(env, id, oldIds);
  await rebuildFts(env);
}

export function csAdminRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  app.use("/api/admin/cs/*", requireAdmin);
  app.use("/api/admin/quick-questions*", requireAdmin);

  // ---------- 客服知识库文章 ----------
  app.get("/api/admin/cs/articles", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT a.id, a.title, a.content_md, a.enabled, a.updated_at,
              (SELECT COUNT(*) FROM cs_chunks c WHERE c.article_id = a.id) AS chunk_count
       FROM cs_articles a ORDER BY a.id DESC`,
    ).all<CsArticleRow>();
    return c.json({ items: results ?? [] });
  });

  app.post("/api/admin/cs/articles", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: string;
      content_md?: string;
      enabled?: boolean;
    };
    const title = (body.title || "").trim();
    if (!title) return c.json({ error: "title required" }, 400);
    const content = body.content_md ?? "";
    const { meta } = await c.env.DB.prepare(
      `INSERT INTO cs_articles (title, content_md, enabled) VALUES (?, ?, ?)`,
    )
      .bind(title, content, body.enabled === false ? 0 : 1)
      .run();
    const id = Number(meta?.last_row_id);
    await saveArticle(c.env, id, title, content);
    return c.json({ id }, 201);
  });

  app.put("/api/admin/cs/articles/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: string;
      content_md?: string;
      enabled?: boolean;
    };
    const title = (body.title || "").trim();
    if (!title) return c.json({ error: "title required" }, 400);
    const content = body.content_md ?? "";
    const enabled = body.enabled === false ? 0 : 1;
    const result = await c.env.DB.prepare(
      `UPDATE cs_articles SET title=?, content_md=?, enabled=?, updated_at=datetime('now') WHERE id=?`,
    )
      .bind(title, content, enabled, id)
      .run();
    if (!result.meta?.changes) return c.json({ error: "not found" }, 404);
    await saveArticle(c.env, id, title, content);
    return c.json({ ok: true });
  });

  app.delete("/api/admin/cs/articles/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const oldIds =
      (
        await c.env.DB.prepare(`SELECT id FROM cs_chunks WHERE article_id = ?`)
          .bind(id)
          .all<{ id: number }>()
      ).results?.map((r) => r.id) ?? [];
    const result = await c.env.DB.prepare(`DELETE FROM cs_articles WHERE id = ?`)
      .bind(id)
      .run();
    if (oldIds.length > 0 && c.env.VEC) {
      try {
        await c.env.VEC.deleteByIds(
          oldIds.map((i) => `cs-${i}`),
          "cs",
        );
      } catch (e) {
        console.error("vector delete failed:", e);
      }
    }
    await rebuildFts(c.env);
    return c.json({ ok: true, deleted: result.meta?.changes ?? 0 });
  });

  app.post("/api/admin/cs/reindex", async (c) => {
    const count = await reindexAllCsArticles(c.env);
    return c.json({ ok: true, chunks: count });
  });

  // 清理孤儿向量:重导入后旧分块 id 的向量仍留在 cs 命名空间,挤占 topK。
  // Vectorize deleteByIds 每次最多 100 个 id;免费版单请求 50 次子请求,
  // 故按 [startId, endId] 范围删除,单请求最多 40 批(4000 个 id),超出部分多次调用。
  app.post("/api/admin/cs/vector-cleanup", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      startId?: number;
      endId?: number;
    };
    const startId = Math.max(1, Number(body.startId ?? 0));
    const endId = Math.min(Number(body.endId ?? 0), 1000000);
    if (!startId || !endId || startId > endId) {
      return c.json({ error: "startId/endId required" }, 400);
    }
    if (!c.env.VEC) return c.json({ error: "vectorize unavailable" }, 503);
    let deleted = 0;
    const BATCH = 100;
    const MAX_BATCHES = 40; // 低于免费版 50 子请求上限
    let batches = 0;
    let cursor = startId;
    for (; cursor <= endId && batches < MAX_BATCHES; cursor += BATCH) {
      const ids: string[] = [];
      for (let i = cursor; i < cursor + BATCH && i <= endId; i++) ids.push(`cs-${i}`);
      try {
        await c.env.VEC.deleteByIds(ids, "cs");
        deleted += ids.length;
      } catch (e) {
        console.error("vector cleanup batch failed:", e);
      }
      batches++;
    }
    const completed = cursor > endId;
    return c.json({ ok: true, deleted, nextStart: completed ? null : cursor });
  });

  // ---------- 会话记录 ----------
  app.get("/api/admin/cs/conversations", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT session_id, COUNT(*) AS msg_count, MAX(created_at) AS last_at,
              MIN(CASE WHEN role = 'user' THEN content END) AS first_question
       FROM chat_messages GROUP BY session_id ORDER BY last_at DESC LIMIT 50`,
    ).all<{ session_id: string; msg_count: number; last_at: string; first_question: string }>();
    return c.json({ items: results ?? [] });
  });

  app.get("/api/admin/cs/conversations/:sid", async (c) => {
    const sid = c.req.param("sid");
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(sid)) {
      return c.json({ error: "invalid session" }, 400);
    }
    const { results } = await c.env.DB.prepare(
      `SELECT id, role, content, created_at FROM chat_messages
       WHERE session_id = ? ORDER BY id ASC LIMIT 200`,
    )
      .bind(sid)
      .all();
    return c.json({ items: results ?? [] });
  });

  // ---------- 快捷提问 ----------
  app.get("/api/admin/quick-questions", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT id, text, sort_order, enabled FROM quick_questions ORDER BY sort_order ASC, id ASC`,
    ).all();
    return c.json({ items: results ?? [] });
  });

  app.post("/api/admin/quick-questions", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      text?: string;
      sort_order?: number;
    };
    const text = (body.text || "").trim();
    if (!text) return c.json({ error: "text required" }, 400);
    const { meta } = await c.env.DB.prepare(
      `INSERT INTO quick_questions (text, sort_order) VALUES (?, ?)`,
    )
      .bind(text, Number(body.sort_order ?? 0))
      .run();
    return c.json({ id: Number(meta?.last_row_id) }, 201);
  });

  app.delete("/api/admin/quick-questions/:id", async (c) => {
    const result = await c.env.DB.prepare(
      `DELETE FROM quick_questions WHERE id = ?`,
    )
      .bind(Number(c.req.param("id")))
      .run();
    return c.json({ ok: true, deleted: result.meta?.changes ?? 0 });
  });

  return app;
}
