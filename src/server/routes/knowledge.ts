import { Hono } from "hono";
import type { Env } from "@shared/env";
import { requireAdmin } from "../auth";
import { rrfFuse } from "../retrieval/rrf";
import { syncNoteVector, unsyncNoteVector, embedTexts } from "../retrieval/indexer";

interface NoteRow {
  id: number;
  title: string;
  content_md: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: NoteRow) {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags || "[]");
  } catch {}
  return { ...row, tags };
}

function parseTags(tags: unknown): string {
  if (Array.isArray(tags)) return JSON.stringify(tags.map(String));
  if (typeof tags === "string") {
    // 允许 "a,b,c" 逗号分隔输入
    return JSON.stringify(
      tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    );
  }
  return "[]";
}

/** FTS5 查询串:按空白拆词,逐词加引号防注入 FTS 语法 */
function ftsQuery(q: string): string {
  return q
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
    .join(" AND ");
}

export function knowledgeRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  app.use("/api/knowledge/*", requireAdmin);
  app.use("/api/knowledge", requireAdmin);

  // 搜索 + 列表:q 为空时返回最近笔记;有 q 时 FTS5(词面) + Vectorize(语义) RRF 融合
  app.get("/api/knowledge", async (c) => {
    const q = (c.req.query("q") || "").trim();
    if (!q) {
      const { results } = await c.env.DB.prepare(
        `SELECT id, title, content_md, tags, created_at, updated_at
         FROM knowledge_notes ORDER BY updated_at DESC LIMIT 50`,
      ).all<NoteRow>();
      return c.json({ items: (results ?? []).map(mapRow) });
    }

    // 词面:FTS5 优先;FTS5 对连续中文按整段切 token,
    // 无命中时(典型为中文短词)回退 LIKE 子串匹配
    const ftsIds: string[] = [];
    try {
      const { results } = await c.env.DB.prepare(
        `SELECT rowid AS id FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT 20`,
      )
        .bind(ftsQuery(q))
        .all<{ id: number }>();
      ftsIds.push(...(results ?? []).map((r) => `note-${r.id}`));
    } catch {
      /* FTS 语法不合法时忽略词面路 */
    }
    if (ftsIds.length === 0) {
      const like = `%${q.replace(/([%_\\])/g, "\\$1")}%`;
      const { results } = await c.env.DB.prepare(
        `SELECT id FROM knowledge_notes
         WHERE title LIKE ? ESCAPE '\\' OR content_md LIKE ? ESCAPE '\\' LIMIT 20`,
      )
        .bind(like, like)
        .all<{ id: number }>();
      ftsIds.push(...(results ?? []).map((r) => `note-${r.id}`));
    }

    // 语义:query embedding → Vectorize notes 命名空间
    const vecIds: string[] = [];
    const vectors = await embedTexts(c.env, [q]);
    if (vectors) {
      try {
        const res = await c.env.VEC.query(vectors[0], {
          topK: 10,
          namespace: "notes",
          returnMetadata: "none",
        });
        vecIds.push(...res.matches.map((m) => m.id));
      } catch (e) {
        console.error("vector query failed:", e);
      }
    }

    const fused = rrfFuse([ftsIds, vecIds]).slice(0, 20);
    if (fused.length === 0) return c.json({ items: [] });

    const ids = fused.map((f) => Number(f.id.replace("note-", "")));
    const placeholders = ids.map(() => "?").join(",");
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, content_md, tags, created_at, updated_at
       FROM knowledge_notes WHERE id IN (${placeholders})`,
    )
      .bind(...ids)
      .all<NoteRow>();
    const byId = new Map((results ?? []).map((r) => [r.id, mapRow(r)]));
    const items = fused
      .map((f) => byId.get(Number(f.id.replace("note-", ""))))
      .filter(Boolean);
    return c.json({ items });
  });

  app.get("/api/knowledge/:id", async (c) => {
    const row = await c.env.DB.prepare(
      `SELECT id, title, content_md, tags, created_at, updated_at
       FROM knowledge_notes WHERE id = ?`,
    )
      .bind(Number(c.req.param("id")))
      .first<NoteRow>();
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json(mapRow(row));
  });

  app.post("/api/knowledge", async (c) => {
    const body = (await c.req.json()) as {
      title?: string;
      content_md?: string;
      tags?: unknown;
    };
    const title = (body.title || "").trim();
    if (!title) return c.json({ error: "title required" }, 400);
    const content = body.content_md ?? "";
    const { meta } = await c.env.DB.prepare(
      `INSERT INTO knowledge_notes (title, content_md, tags) VALUES (?, ?, ?)`,
    )
      .bind(title, content, parseTags(body.tags))
      .run();
    const id = Number(meta?.last_row_id);
    const note = { id, title, content_md: content };
    await syncNoteVector(c.env, note);
    return c.json({ id }, 201);
  });

  app.put("/api/knowledge/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json()) as {
      title?: string;
      content_md?: string;
      tags?: unknown;
    };
    const title = (body.title || "").trim();
    if (!title) return c.json({ error: "title required" }, 400);
    const content = body.content_md ?? "";
    const result = await c.env.DB.prepare(
      `UPDATE knowledge_notes SET title = ?, content_md = ?, tags = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(title, content, parseTags(body.tags), id)
      .run();
    if (!result.meta?.changes) return c.json({ error: "not found" }, 404);
    await syncNoteVector(c.env, { id, title, content_md: content });
    return c.json({ ok: true });
  });

  app.delete("/api/knowledge/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const result = await c.env.DB.prepare(
      `DELETE FROM knowledge_notes WHERE id = ?`,
    )
      .bind(id)
      .run();
    await unsyncNoteVector(c.env, id);
    return c.json({ ok: true, deleted: result.meta?.changes ?? 0 });
  });

  return app;
}
