import { Hono } from "hono";
import type { Env } from "@shared/env";
import type { DigestDetail, DigestListItem, NewsItem } from "@shared/types";

interface DigestRow {
  digest_date: string;
  item_count: number;
}

interface DigestDetailRow {
  digest_date: string;
  summary_md: string;
  model: string;
  item_count: number;
}

interface NewsRow {
  id: number;
  source: string;
  title: string;
  url: string;
  ai_summary: string;
  published_at: string | null;
}

function mapNews(row: NewsRow): NewsItem {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    url: row.url,
    aiSummary: row.ai_summary,
    publishedAt: row.published_at,
  };
}

export function digestRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  // 日报日期列表(新→旧)
  app.get("/api/digests", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT digest_date, item_count FROM daily_digests ORDER BY digest_date DESC LIMIT 90`,
    ).all<DigestRow>();
    const items: DigestListItem[] = (results ?? []).map((r) => ({
      date: r.digest_date,
      itemCount: r.item_count,
    }));
    return c.json({ items });
  });

  // 某天日报详情(含条目)
  app.get("/api/digests/:date", async (c) => {
    const date = c.req.param("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: "invalid date" }, 400);
    }
    const digest = await c.env.DB.prepare(
      `SELECT digest_date, summary_md, model, item_count FROM daily_digests WHERE digest_date = ?`,
    )
      .bind(date)
      .first<DigestDetailRow>();
    if (!digest) return c.json({ error: "not found" }, 404);

    const { results } = await c.env.DB.prepare(
      `SELECT id, source, title, url, ai_summary, published_at
       FROM news_items WHERE digest_date = ? ORDER BY id ASC`,
    )
      .bind(date)
      .all<NewsRow>();

    const detail: DigestDetail = {
      date: digest.digest_date,
      summaryMd: digest.summary_md,
      model: digest.model,
      itemCount: digest.item_count,
      items: (results ?? []).map(mapNews),
    };
    return c.json(detail);
  });

  return app;
}
