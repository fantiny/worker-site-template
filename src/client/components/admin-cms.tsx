import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createPost,
  deletePost,
  fetchAbout,
  fetchAdminPost,
  fetchAdminPosts,
  saveSetting,
  updatePost,
  type PostDetail,
  type PostListItem,
} from "@/api";

/** 博客文章管理(CMS) */
export function PostsSection() {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [draft, setDraft] = useState<
    {
      id: number | null;
      title: string;
      summary: string;
      content_md: string;
      tags: string;
      published: boolean;
    } | null
  >(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetchAdminPosts().then(setPosts).catch(() => setPosts([]));

  useEffect(() => {
    load();
  }, []);

  const openNew = () =>
    setDraft({ id: null, title: "", summary: "", content_md: "", tags: "", published: false });

  const openPost = async (id: number) => {
    const p: PostDetail = await fetchAdminPost(id);
    setDraft({
      id: p.id,
      title: p.title,
      summary: p.summary,
      content_md: p.contentMd,
      tags: p.tags.join(", "),
      published: p.published,
    });
  };

  const save = async () => {
    if (!draft?.title.trim()) return;
    setBusy(true);
    try {
      const body = {
        title: draft.title.trim(),
        summary: draft.summary,
        content_md: draft.content_md,
        tags: draft.tags,
        published: draft.published,
      };
      if (draft.id === null) await createPost(body);
      else await updatePost(draft.id, body);
      setDraft(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 className="flex items-center justify-between text-lg font-semibold">
        ✍️ 博客文章
        <button
          onClick={openNew}
          className="rounded-card bg-brand px-3 py-1.5 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong"
        >
          + 写新文章
        </button>
      </h2>
      <p className="mt-2 text-xs text-ink-muted">
        发布后出现在 /blog 公开页面;slug 由标题自动生成。
      </p>

      {draft && (
        <div className="mt-4 rounded-card border border-line bg-surface shadow-card p-5">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="标题 *"
            className="w-full rounded-card border border-line bg-base px-3 py-2 font-semibold outline-none focus:border-brand"
          />
          <input
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            placeholder="摘要(列表页展示)"
            className="mt-2 w-full rounded-card border border-line bg-base px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <textarea
            value={draft.content_md}
            onChange={(e) => setDraft({ ...draft, content_md: e.target.value })}
            placeholder="正文(Markdown)"
            rows={14}
            className="mt-2 w-full resize-y rounded-card border border-line bg-base px-3 py-2 font-mono text-sm leading-relaxed outline-none focus:border-brand"
          />
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <input
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              placeholder="标签(逗号分隔)"
              className="rounded-card border border-line bg-base px-3 py-1.5 outline-none focus:border-brand"
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              />
              发布
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setDraft(null)}
              className="rounded-card border border-line px-4 py-2 text-sm transition-colors hover:text-accent"
            >
              取消
            </button>
            <button
              onClick={save}
              disabled={busy || !draft.title.trim()}
              className="rounded-card bg-brand px-4 py-2 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              {busy ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {posts === null && <div className="h-16 animate-pulse rounded-card bg-raised" />}
        {posts?.length === 0 && (
          <p className="text-sm text-ink-muted">还没有文章。</p>
        )}
        {posts?.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-card border border-line bg-surface shadow-card px-4 py-3 text-sm"
          >
            <span
              className={`shrink-0 rounded-card px-2 py-0.5 text-xs ${
                p.published ? "bg-brand text-onbrand" : "border border-line text-ink-muted"
              }`}
            >
              {p.published ? "已发布" : "草稿"}
            </span>
            <Link
              to={`/blog/${p.slug}`}
              className="truncate font-medium hover:text-brand"
              title="查看线上页面"
            >
              {p.title}
            </Link>
            <span className="ml-auto flex shrink-0 gap-2 text-xs">
              <button
                onClick={() => openPost(p.id)}
                className="rounded-card border border-line px-3 py-1 transition-colors hover:border-brand hover:text-brand"
              >
                编辑
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`删除文章「${p.title}」?`)) return;
                  await deletePost(p.id);
                  load();
                }}
                className="rounded-card border border-line px-3 py-1 transition-colors hover:border-accent hover:text-accent"
              >
                删除
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 关于页 Markdown 编辑 */
export function AboutSection() {
  const [md, setMd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetchAbout().then(setMd).catch(() => setMd(""));
  }, []);

  return (
    <section>
      <h2 className="flex items-center justify-between text-lg font-semibold">
        👤 关于页内容
        <button
          onClick={async () => {
            if (md === null) return;
            setBusy(true);
            setNotice("");
            try {
              await saveSetting("about_md", md);
              setNotice("已保存,线上 /about 即时生效。");
            } catch {
              setNotice("保存失败,请重试。");
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || md === null}
          className="rounded-card bg-brand px-3 py-1.5 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {busy ? "保存中…" : "保存"}
        </button>
      </h2>
      <p className="mt-2 text-xs text-ink-muted">
        Markdown,展示在公开 /about 页面。注意不要填写电话、邮箱、住址等隐私信息。
      </p>
      {notice && <p className="mt-2 text-sm text-accent">{notice}</p>}
      {md === null ? (
        <div className="mt-4 h-40 animate-pulse rounded-card bg-raised" />
      ) : (
        <textarea
          value={md}
          onChange={(e) => setMd(e.target.value)}
          rows={16}
          className="mt-4 w-full resize-y rounded-card border border-line bg-surface px-3 py-2 font-mono text-sm leading-relaxed outline-none focus:border-brand"
        />
      )}
    </section>
  );
}
