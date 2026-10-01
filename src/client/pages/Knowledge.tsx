import { useCallback, useEffect, useRef, useState } from "react";
import { LoginGate, useAuth } from "@/auth";
import {
  createNote,
  deleteNote,
  fetchNote,
  fetchNotes,
  updateNote,
  type KnowledgeNote,
} from "@/api";
import { renderMarkdown } from "@/markdown";

export function Knowledge() {
  return (
    <LoginGate>
      <KnowledgeInner />
    </LoginGate>
  );
}

function KnowledgeInner() {
  const { authed } = useAuth();
  const [notes, setNotes] = useState<KnowledgeNote[] | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<
    { id: number | null; title: string; content: string; tags: string } | null
  >(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(null);

  const load = useCallback((q: string) => {
    fetchNotes(q)
      .then(setNotes)
      .catch(() => setNotes([]));
  }, []);

  useEffect(() => {
    if (authed) load("");
  }, [authed, load]);

  const onSearch = (v: string) => {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(v.trim()), 300);
  };

  const openNew = () =>
    setEditing({ id: null, title: "", content: "", tags: "" });

  const openNote = async (id: number) => {
    const n = await fetchNote(id);
    setEditing({
      id: n.id,
      title: n.title,
      content: n.content_md,
      tags: n.tags.join(", "),
    });
    setPreview(false);
  };

  const save = async () => {
    if (!editing?.title.trim()) return;
    setSaving(true);
    try {
      const body = {
        title: editing.title.trim(),
        content_md: editing.content,
        tags: editing.tags,
      };
      if (editing.id === null) {
        await createNote(body);
      } else {
        await updateNote(editing.id, body);
      }
      setEditing(null);
      load(query.trim());
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("确认删除这条笔记?")) return;
    await deleteNote(id);
    if (editing?.id === id) setEditing(null);
    load(query.trim());
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">知识库</h1>
          <p className="mt-1 text-sm text-ink-muted">
            支持关键词(标题/正文)与语义搜索(理解意思相近的说法)。
          </p>
        </div>
        <button
          onClick={openNew}
          className="shrink-0 rounded-card bg-brand px-4 py-2 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong"
        >
          + 新建笔记
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="搜索笔记…"
        className="mt-5 w-full rounded-card border border-line bg-surface shadow-card px-4 py-2.5 text-sm outline-none focus:border-brand"
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* 笔记列表 */}
        <aside className="space-y-2 lg:max-h-[65vh] lg:overflow-y-auto">
          {notes === null && (
            <div className="h-24 animate-pulse rounded-card bg-raised" />
          )}
          {notes?.length === 0 && (
            <p className="text-sm text-ink-muted">
              {query ? "没有匹配的笔记。" : "还没有笔记,点右上角新建。"}
            </p>
          )}
          {notes?.map((n) => (
            <div
              key={n.id}
              className={`group cursor-pointer rounded-card border p-3 transition-colors ${
                editing?.id === n.id
                  ? "border-brand bg-raised"
                  : "border-line bg-surface hover:border-brand"
              }`}
              onClick={() => openNote(n.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium leading-snug">{n.title}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(n.id);
                  }}
                  className="shrink-0 text-xs text-ink-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                  aria-label={`删除 ${n.title}`}
                >
                  删除
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                {n.content_md || "(空)"}
              </p>
              <p className="mt-1.5 text-[11px] text-ink-muted">
                {n.updated_at.slice(0, 10)}
              </p>
            </div>
          ))}
        </aside>

        {/* 编辑器 */}
        <section className="min-h-[40vh]">
          {!editing && (
            <div className="flex h-full items-center justify-center rounded-card border border-dashed border-line p-10 text-sm text-ink-muted">
              从左侧选择笔记,或新建一条。
            </div>
          )}
          {editing && (
            <div className="rounded-card border border-line bg-surface shadow-card p-5">
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="标题"
                className="w-full rounded-card border border-line bg-base px-3 py-2 font-semibold outline-none focus:border-brand"
              />
              <input
                value={editing.tags}
                onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                placeholder="标签(逗号分隔)"
                className="mt-2 w-full rounded-card border border-line bg-base px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => setPreview((v) => !v)}
                  className="rounded-card border border-line px-3 py-1 text-xs transition-colors hover:border-brand hover:text-brand"
                >
                  {preview ? "返回编辑" : "预览 Markdown"}
                </button>
              </div>
              {preview ? (
                <div
                  className="prose-sm mt-2 max-h-[50vh] min-h-[30vh] overflow-y-auto rounded-card border border-line bg-base p-4 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-card [&_pre]:bg-raised [&_pre]:p-3 [&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-ink-muted [&_a]:text-brand [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(editing.content) }}
                />
              ) : (
                <textarea
                  value={editing.content}
                  onChange={(e) =>
                    setEditing({ ...editing, content: e.target.value })
                  }
                  placeholder="正文(Markdown)"
                  rows={16}
                  className="mt-2 w-full resize-y rounded-card border border-line bg-base px-3 py-2 font-mono text-sm leading-relaxed outline-none focus:border-brand"
                />
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-card border border-line px-4 py-2 text-sm transition-colors hover:text-accent"
                >
                  取消
                </button>
                <button
                  onClick={save}
                  disabled={saving || !editing.title.trim()}
                  className="rounded-card bg-brand px-4 py-2 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong disabled:opacity-50"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
