import type { Env } from "@shared/env";
import { getProvider } from "../ai/provider";

/** 批量生成 embedding;本地 dev 无 AI 绑定时返回 null(调用方跳过同步) */
export async function embedTexts(
  env: Env,
  texts: string[],
): Promise<number[][] | null> {
  if (!env.AI || texts.length === 0) return null;
  try {
    return await getProvider(env).embed(texts);
  } catch (e) {
    console.error("embed failed:", e);
    return null;
  }
}

/**
 * 个人笔记 → Vectorize `notes` 命名空间。
 * upsert 同一 id 即覆盖旧向量,更新/新建统一走这里。
 */
export async function syncNoteVector(
  env: Env,
  note: { id: number; title: string; content_md: string },
): Promise<void> {
  if (!env.VEC) return;
  const vectors = await embedTexts(
    env,
    [`${note.title}\n\n${note.content_md}`.slice(0, 6000)],
  );
  if (!vectors) return;
  await env.VEC.upsert([
    {
      id: `note-${note.id}`,
      values: vectors[0],
      namespace: "notes",
      metadata: { noteId: note.id },
    },
  ]);
}

export async function unsyncNoteVector(env: Env, noteId: number): Promise<void> {
  if (!env.VEC) return;
  try {
    await env.VEC.deleteByIds([`note-${noteId}`], "notes");
  } catch (e) {
    console.error("vector delete failed:", e);
  }
}
