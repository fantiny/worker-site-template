import { Hono } from "hono";
import type { Env } from "@shared/env";
import { requireAdmin } from "../auth";
import { runDigest } from "../cron/digest";

interface PortfolioRow {
  id: number;
  title: string;
  description: string;
  tech_stack: string;
  cover_url: string;
  links_json: string;
  sort_order: number;
  visible: number;
  detail_md: string;
}

function normalize(body: {
  title?: string;
  description?: string;
  techStack?: unknown;
  coverUrl?: string;
  links?: unknown;
  sortOrder?: number;
  visible?: boolean;
  detailMd?: string;
}) {
  const title = (body.title || "").trim();
  const tech = Array.isArray(body.techStack) ? JSON.stringify(body.techStack.map(String)) : "[]";
  const links = Array.isArray(body.links) ? JSON.stringify(body.links) : "[]";
  return {
    title,
    description: body.description ?? "",
    tech,
    coverUrl: body.coverUrl ?? "",
    links,
    sortOrder: Number(body.sortOrder ?? 0),
    visible: body.visible === false ? 0 : 1,
    detailMd: body.detailMd ?? "",
  };
}

export function adminRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  app.use("/api/admin/*", requireAdmin);

  // ---------- 作品管理 ----------
  app.get("/api/admin/portfolio", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, description, tech_stack, cover_url, links_json, sort_order, visible, detail_md
       FROM portfolio_items ORDER BY sort_order ASC, id ASC`,
    ).all<PortfolioRow>();
    return c.json({ items: results ?? [] });
  });

  app.post("/api/admin/portfolio", async (c) => {
    const body = await c.req.json();
    const n = normalize(body);
    if (!n.title) return c.json({ error: "title required" }, 400);
    const { meta } = await c.env.DB.prepare(
      `INSERT INTO portfolio_items (title, description, tech_stack, cover_url, links_json, sort_order, visible, detail_md)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(n.title, n.description, n.tech, n.coverUrl, n.links, n.sortOrder, n.visible, n.detailMd)
      .run();
    return c.json({ id: Number(meta?.last_row_id) }, 201);
  });

  app.put("/api/admin/portfolio/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const n = normalize(body);
    if (!n.title) return c.json({ error: "title required" }, 400);
    const result = await c.env.DB.prepare(
      `UPDATE portfolio_items SET title=?, description=?, tech_stack=?, cover_url=?, links_json=?, sort_order=?, visible=?, detail_md=?
       WHERE id = ?`,
    )
      .bind(n.title, n.description, n.tech, n.coverUrl, n.links, n.sortOrder, n.visible, n.detailMd, id)
      .run();
    if (!result.meta?.changes) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  app.delete("/api/admin/portfolio/:id", async (c) => {
    const result = await c.env.DB.prepare(
      `DELETE FROM portfolio_items WHERE id = ?`,
    )
      .bind(Number(c.req.param("id")))
      .run();
    return c.json({ ok: true, deleted: result.meta?.changes ?? 0 });
  });

  // ---------- RSS 源管理 ----------
  app.get("/api/admin/feed-sources", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT id, name, url, enabled FROM feed_sources ORDER BY id ASC`,
    ).all();
    return c.json({ items: results ?? [] });
  });

  app.post("/api/admin/feed-sources", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      name?: string;
      url?: string;
    };
    const name = (body.name || "").trim();
    const url = (body.url || "").trim();
    if (!name || !/^https?:\/\//.test(url)) {
      return c.json({ error: "name 与合法 URL 必填" }, 400);
    }
    try {
      const { meta } = await c.env.DB.prepare(
        `INSERT INTO feed_sources (name, url) VALUES (?, ?)`,
      )
        .bind(name, url)
        .run();
      return c.json({ id: Number(meta?.last_row_id) }, 201);
    } catch {
      return c.json({ error: "该 URL 已存在" }, 409);
    }
  });

  app.put("/api/admin/feed-sources/:id", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
    const result = await c.env.DB.prepare(
      `UPDATE feed_sources SET enabled = ? WHERE id = ?`,
    )
      .bind(body.enabled === false ? 0 : 1, Number(c.req.param("id")))
      .run();
    if (!result.meta?.changes) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  app.delete("/api/admin/feed-sources/:id", async (c) => {
    const result = await c.env.DB.prepare(`DELETE FROM feed_sources WHERE id = ?`)
      .bind(Number(c.req.param("id")))
      .run();
    return c.json({ ok: true, deleted: result.meta?.changes ?? 0 });
  });

  // ---------- 日报手动触发 ----------
  app.post("/api/admin/digest/run", async (c) => {
    try {
      const result = await runDigest(c.env);
      return c.json({ ok: true, ...result });
    } catch (e) {
      console.error("manual digest failed:", e);
      return c.json({ error: "日报生成失败,请查看 Worker 日志" }, 500);
    }
  });

  return app;
}
