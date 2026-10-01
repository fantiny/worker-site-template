import { Hono } from "hono";
import type { Env } from "@shared/env";
import { requireAdmin } from "../auth";

interface PostRow {
  id: number;
  slug: string;
  title: string;
  summary: string;
  content_md: string;
  tags: string;
  published: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: PostRow, withContent: boolean) {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags || "[]");
  } catch {}
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    tags,
    published: Boolean(row.published),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(withContent ? { contentMd: row.content_md } : {}),
  };
}

function slugify(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii.length >= 3) return ascii.slice(0, 60);
  // 纯中文标题:时间戳兜底
  return `post-${Date.now().toString(36)}`;
}

export function postRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  // ---------- 公开:已发布文章 ----------
  app.get("/api/posts", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT id, slug, title, summary, tags, published, published_at, created_at, updated_at
       FROM posts WHERE published = 1 ORDER BY published_at DESC, id DESC LIMIT 100`,
    ).all<PostRow>();
    return c.json({ items: (results ?? []).map((r) => mapRow(r, false)) });
  });

  app.get("/api/posts/:slug", async (c) => {
    const row = await c.env.DB.prepare(
      `SELECT id, slug, title, summary, content_md, tags, published, published_at, created_at, updated_at
       FROM posts WHERE slug = ? AND published = 1`,
    )
      .bind(c.req.param("slug"))
      .first<PostRow>();
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json(mapRow(row, true));
  });

  // ---------- 管理 ----------
  app.use("/api/admin/posts*", requireAdmin);

  app.get("/api/admin/posts", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT id, slug, title, summary, tags, published, published_at, created_at, updated_at
       FROM posts ORDER BY id DESC LIMIT 200`,
    ).all<PostRow>();
    return c.json({ items: (results ?? []).map((r) => mapRow(r, false)) });
  });

  app.get("/api/admin/posts/:id", async (c) => {
    const row = await c.env.DB.prepare(
      `SELECT id, slug, title, summary, content_md, tags, published, published_at, created_at, updated_at
       FROM posts WHERE id = ?`,
    )
      .bind(Number(c.req.param("id")))
      .first<PostRow>();
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json(mapRow(row, true));
  });

  app.post("/api/admin/posts", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: string;
      summary?: string;
      content_md?: string;
      tags?: unknown;
      published?: boolean;
    };
    const title = (body.title || "").trim();
    if (!title) return c.json({ error: "title required" }, 400);
    const slug = slugify(title);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const published = body.published === true;
    const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags.map(String)) : "[]";
    let id: number;
    try {
      const { meta } = await c.env.DB.prepare(
        `INSERT INTO posts (slug, title, summary, content_md, tags, published, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(slug, title, body.summary ?? "", body.content_md ?? "", tags, published ? 1 : 0, published ? now : null)
        .run();
      id = Number(meta?.last_row_id);
    } catch {
      // slug 冲突:追加短随机后缀重试一次
      const slug2 = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const { meta } = await c.env.DB.prepare(
        `INSERT INTO posts (slug, title, summary, content_md, tags, published, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(slug2, title, body.summary ?? "", body.content_md ?? "", tags, published ? 1 : 0, published ? now : null)
        .run();
      id = Number(meta?.last_row_id);
    }
    return c.json({ id }, 201);
  });

  app.put("/api/admin/posts/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => ({}))) as {
      title?: string;
      summary?: string;
      content_md?: string;
      tags?: unknown;
      published?: boolean;
    };
    const title = (body.title || "").trim();
    if (!title) return c.json({ error: "title required" }, 400);
    const published = body.published === true;
    const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags.map(String)) : "[]";
    const result = await c.env.DB.prepare(
      `UPDATE posts SET title=?, summary=?, content_md=?, tags=?, published=?,
         published_at = COALESCE(published_at, CASE WHEN ? = 1 THEN datetime('now') END),
         updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(title, body.summary ?? "", body.content_md ?? "", tags, published ? 1 : 0, published ? 1 : 0, id)
      .run();
    if (!result.meta?.changes) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  app.delete("/api/admin/posts/:id", async (c) => {
    const result = await c.env.DB.prepare(`DELETE FROM posts WHERE id = ?`)
      .bind(Number(c.req.param("id")))
      .run();
    return c.json({ ok: true, deleted: result.meta?.changes ?? 0 });
  });

  // ---------- 关于页内容(站点设置) ----------
  app.get("/api/about", async (c) => {
    const row = await c.env.DB.prepare(
      `SELECT value FROM site_settings WHERE key = 'about_md'`,
    ).first<{ value: string }>();
    return c.json({ aboutMd: row?.value ?? "" });
  });

  app.put("/api/admin/settings", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      key?: string;
      value?: string;
    };
    const key = (body.key || "").trim();
    if (!key) return c.json({ error: "key required" }, 400);
    await c.env.DB.prepare(
      `INSERT INTO site_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
      .bind(key, body.value ?? "")
      .run();
    return c.json({ ok: true });
  });

  return app;
}
