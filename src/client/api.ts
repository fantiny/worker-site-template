import type {
  DigestDetail,
  DigestListItem,
  PortfolioItem,
} from "@shared/types";

export interface KnowledgeNote {
  id: number;
  title: string;
  content_md: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

export async function sendJson<T>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchPortfolio(): Promise<PortfolioItem[]> {
  const data = await getJson<{ items: PortfolioItem[] }>("/api/portfolio");
  return data.items;
}

export async function fetchDigestList(): Promise<DigestListItem[]> {
  const data = await getJson<{ items: DigestListItem[] }>("/api/digests");
  return data.items;
}

export async function fetchDigest(date: string): Promise<DigestDetail> {
  return getJson<DigestDetail>(`/api/digests/${date}`);
}

// ---------- 知识库 ----------
export async function fetchNotes(q = ""): Promise<KnowledgeNote[]> {
  const data = await getJson<{ items: KnowledgeNote[] }>(
    `/api/knowledge${q ? `?q=${encodeURIComponent(q)}` : ""}`,
  );
  return data.items;
}

export async function fetchNote(id: number): Promise<KnowledgeNote> {
  return getJson<KnowledgeNote>(`/api/knowledge/${id}`);
}

export function createNote(body: {
  title: string;
  content_md: string;
  /** 逗号分隔字符串或数组均可,服务端统一解析 */
  tags: string;
}): Promise<{ id: number }> {
  return sendJson("/api/knowledge", "POST", body);
}

export function updateNote(
  id: number,
  body: { title: string; content_md: string; tags: string },
): Promise<{ ok: boolean }> {
  return sendJson(`/api/knowledge/${id}`, "PUT", body);
}

export function deleteNote(id: number): Promise<{ ok: boolean }> {
  return sendJson(`/api/knowledge/${id}`, "DELETE");
}

// ---------- 后台作品管理 ----------
export interface AdminPortfolioItem {
  id: number;
  title: string;
  description: string;
  coverUrl: string;
  links: { label: string; url: string }[];
  techStack: string[];
  sortOrder: number;
  visible: boolean;
  detailMd?: string;
}

interface AdminPortfolioRow {
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

function safeParse(s: string): string[] {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parseLinks(s: string): { label: string; url: string }[] {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function fetchAdminPortfolio(): Promise<AdminPortfolioItem[]> {
  const data = await getJson<{ items: AdminPortfolioRow[] }>("/api/admin/portfolio");
  return data.items.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    coverUrl: r.cover_url,
    links: parseLinks(r.links_json),
    techStack: safeParse(r.tech_stack),
    sortOrder: r.sort_order,
    visible: Boolean(r.visible),
    detailMd: r.detail_md ?? "",
  }));
}

export function saveAdminPortfolio(
  item: AdminPortfolioItem & { links: { label: string; url: string }[] },
  isNew: boolean,
): Promise<{ id?: number; ok?: boolean }> {
  const body = {
    title: item.title,
    description: item.description,
    techStack: item.techStack,
    coverUrl: item.coverUrl,
    links: item.links,
    sortOrder: item.sortOrder,
    visible: item.visible,
    detailMd: item.detailMd ?? "",
  };
  return isNew
    ? sendJson("/api/admin/portfolio", "POST", body)
    : sendJson(`/api/admin/portfolio/${item.id}`, "PUT", body);
}

export function deleteAdminPortfolio(id: number): Promise<{ ok: boolean }> {
  return sendJson(`/api/admin/portfolio/${id}`, "DELETE");
}

// ---------- 提示词工具 ----------
export async function generatePrompt(body: {
  idea: string;
  scenario: string;
  format: string;
  depth: string;
  optimize: boolean;
}): Promise<{ prompt: string }> {
  const res = await fetch("/api/prompts/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { prompt?: string; error?: string };
  if (!res.ok) throw new Error(data.error || `生成失败 (${res.status})`);
  return { prompt: data.prompt! };
}

export interface SavedPrompt {
  id: number;
  kind: string;
  name: string;
  content: string;
  meta_json: string;
  created_at: string;
}

export async function fetchSavedPrompts(): Promise<SavedPrompt[]> {
  const data = await getJson<{ items: SavedPrompt[] }>("/api/prompts/saved");
  return data.items;
}

export function savePrompt(body: {
  name: string;
  content: string;
  meta: Record<string, unknown>;
}): Promise<{ id: number }> {
  return sendJson("/api/prompts/saved", "POST", body);
}

export function deleteSavedPrompt(id: number): Promise<{ ok: boolean }> {
  return sendJson(`/api/prompts/saved/${id}`, "DELETE");
}

// ---------- 作品详情 ----------
export async function fetchPortfolioItem(
  id: string | number,
): Promise<PortfolioItem & { detailMd: string }> {
  return getJson(`/api/portfolio/${id}`);
}

// ---------- 博客 ----------
export interface PostListItem {
  id: number;
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostDetail extends PostListItem {
  contentMd: string;
}

export async function fetchPosts(): Promise<PostListItem[]> {
  const data = await getJson<{ items: PostListItem[] }>("/api/posts");
  return data.items;
}

export async function fetchPost(slug: string): Promise<PostDetail> {
  return getJson<PostDetail>(`/api/posts/${slug}`);
}

export async function fetchAbout(): Promise<string> {
  const data = await getJson<{ aboutMd: string }>("/api/about");
  return data.aboutMd;
}

export function saveSetting(key: string, value: string): Promise<{ ok: boolean }> {
  return sendJson("/api/admin/settings", "PUT", { key, value });
}

// ---------- 后台:博客文章 ----------
export async function fetchAdminPosts(): Promise<PostListItem[]> {
  const data = await getJson<{ items: PostListItem[] }>("/api/admin/posts");
  return data.items;
}

export async function fetchAdminPost(id: number): Promise<PostDetail> {
  return getJson<PostDetail>(`/api/admin/posts/${id}`);
}

export function createPost(body: {
  title: string;
  summary: string;
  content_md: string;
  tags: string;
  published: boolean;
}): Promise<{ id: number }> {
  return sendJson("/api/admin/posts", "POST", body);
}

export function updatePost(
  id: number,
  body: {
    title: string;
    summary: string;
    content_md: string;
    tags: string;
    published: boolean;
  },
): Promise<{ ok: boolean }> {
  return sendJson(`/api/admin/posts/${id}`, "PUT", body);
}

export function deletePost(id: number): Promise<{ ok: boolean }> {
  return sendJson(`/api/admin/posts/${id}`, "DELETE");
}
