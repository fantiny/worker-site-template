import { Hono } from "hono";
import type { Env } from "@shared/env";
import type { PortfolioItem } from "@shared/types";

interface PortfolioRow {
  id: number;
  title: string;
  description: string;
  tech_stack: string;
  cover_url: string;
  links_json: string;
}

function mapRow(row: PortfolioRow): PortfolioItem {
  let techStack: string[] = [];
  let links: { label: string; url: string }[] = [];
  try {
    techStack = JSON.parse(row.tech_stack || "[]");
  } catch {}
  try {
    links = JSON.parse(row.links_json || "[]");
  } catch {}
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    techStack,
    coverUrl: row.cover_url,
    links,
  };
}

export function portfolioRoutes() {
  return new Hono<{ Bindings: Env }>()
    .get("/api/portfolio", async (c) => {
      const { results } = await c.env.DB.prepare(
        `SELECT id, title, description, tech_stack, cover_url, links_json
         FROM portfolio_items WHERE visible = 1 ORDER BY sort_order ASC, id ASC`,
      ).all<PortfolioRow>();
      return c.json({ items: (results ?? []).map(mapRow) });
    })
    // 作品详情(公开):含 detail_md 长介绍
    .get("/api/portfolio/:id", async (c) => {
      const row = await c.env.DB.prepare(
        `SELECT id, title, description, tech_stack, cover_url, links_json, detail_md
         FROM portfolio_items WHERE id = ? AND visible = 1`,
      )
        .bind(Number(c.req.param("id")))
        .first<PortfolioRow & { detail_md: string }>();
      if (!row) return c.json({ error: "not found" }, 404);
      return c.json({ ...mapRow(row), detailMd: row.detail_md });
    });
}
