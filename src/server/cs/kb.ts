import type { Env } from "@shared/env";
import { chunkText } from "./chunk";
import { tokenizeText } from "@shared/cjk";
import { embedTexts } from "../retrieval/indexer";

/**
 * 清洗文章正文:去掉微信公众号文章的图片、链接目标、裸长 URL 与残留 HTML 标签。
 * 图片/URL 会以 ~97% 的比例污染分块,稀释 FTS 与 embedding 的语义信号。
 */
export function cleanArticleText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // ![alt](图片URL)
    .replace(/\((https?:\/\/[^)\s]{8,})\)/g, "") // [文字](链接) → 保留文字
    .replace(/https?:\/\/\S{12,}/g, "") // 裸长 URL
    .replace(/<\/?[a-zA-Z][^>]{0,100}>/g, " ") // 残留 HTML 标签
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 对单篇文章清洗、分块入库(替换旧块),返回块数;向量同步由调用方负责 */
export async function chunkAndStoreArticle(
  env: Env,
  articleId: number,
  title: string,
  contentMd: string,
): Promise<number> {
  const chunks = chunkText(cleanArticleText(contentMd));
  await env.DB.prepare(`DELETE FROM cs_chunks WHERE article_id = ?`)
    .bind(articleId)
    .run();
  if (chunks.length === 0) return 0;
  const titleTokens = tokenizeText(title);
  const stmts = chunks.map((text, ord) =>
    env.DB.prepare(
      `INSERT INTO cs_chunks (article_id, ord, title, chunk_text, tokens, title_tokens) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(articleId, ord, title, text, tokenizeText(text), titleTokens),
  );
  await env.DB.batch(stmts);
  return chunks.length;
}

/** 全量重建 FTS 索引(秒级);保存/删除文章后调用,清理孤立条目 */
export async function rebuildFts(env: Env): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO cs_chunks_fts(cs_chunks_fts) VALUES ('rebuild')`,
    ).run();
  } catch (e) {
    console.error("fts rebuild failed:", e);
  }
}

/**
 * 同步文章向量:删除旧块向量 → 重新 embedding 新块 → upsert 到 `cs` 命名空间。
 * 调用前须先取旧块 id(重分块会替换行,id 会变)。
 */
export async function syncArticleVectors(
  env: Env,
  articleId: number,
  oldChunkIds: number[],
): Promise<void> {
  if (!env.VEC) return;
  try {
    if (oldChunkIds.length > 0) {
      await env.VEC.deleteByIds(
        oldChunkIds.map((i) => `cs-${i}`),
        "cs",
      );
    }
  } catch (e) {
    console.error("vector delete failed:", e);
  }
  if (!env.AI) return;

  const { results } = await env.DB.prepare(
    `SELECT id, title, chunk_text FROM cs_chunks WHERE article_id = ? ORDER BY ord`,
  )
    .bind(articleId)
    .all<{ id: number; title: string; chunk_text: string }>();
  const rows = results ?? [];
  if (rows.length === 0) return;

  const vectors: {
    id: string;
    values: number[];
    namespace: string;
    metadata: Record<string, unknown>;
  }[] = [];
  const BATCH = 16;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const values = await embedTexts(
      env,
      batch.map((r) => `${r.title}\n${r.chunk_text}`.slice(0, 6000)),
    );
    if (!values) return;
    batch.forEach((r, j) =>
      vectors.push({
        id: `cs-${r.id}`,
        values: values[j],
        namespace: "cs",
        metadata: { articleId },
      }),
    );
  }
  try {
    await env.VEC.upsert(vectors);
  } catch (e) {
    console.error("vector upsert failed:", e);
  }
}

/** 全库重建分块与向量(admin 手动触发) */
export async function reindexAllCsArticles(env: Env): Promise<number> {
  const oldIds = (
    await env.DB.prepare(`SELECT id FROM cs_chunks`).all<{ id: number }>()
  ).results?.map((r) => r.id) ?? [];
  const { results: articles } = await env.DB.prepare(
    `SELECT id, title, content_md FROM cs_articles WHERE enabled = 1`,
  ).all<{ id: number; title: string; content_md: string }>();

  await env.DB.prepare(`DELETE FROM cs_chunks`).run();
  let count = 0;
  for (const article of articles ?? []) {
    count += await chunkAndStoreArticle(
      env,
      article.id,
      article.title,
      article.content_md,
    );
    await syncArticleVectors(env, article.id, []);
  }
  try {
    if (oldIds.length > 0) {
      await env.VEC.deleteByIds(
        oldIds.map((i) => `cs-${i}`),
        "cs",
      );
    }
  } catch (e) {
    console.error("vector bulk delete failed:", e);
  }
  await rebuildFts(env);
  return count;
}
