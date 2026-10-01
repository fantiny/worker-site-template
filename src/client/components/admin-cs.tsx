import { useEffect, useState } from "react";
import { sendJson, getJson } from "@/api";

export interface CsArticle {
  id: number;
  title: string;
  content_md: string;
  enabled: number;
  updated_at: string;
  chunk_count: number;
}

export async function fetchCsArticles(): Promise<CsArticle[]> {
  const data = await getJson<{ items: CsArticle[] }>("/api/admin/cs/articles");
  return data.items;
}

export function saveCsArticle(body: {
  id: number | null;
  title: string;
  content_md: string;
  enabled: boolean;
}): Promise<{ id?: number; ok?: boolean }> {
  return body.id === null
    ? sendJson("/api/admin/cs/articles", "POST", body)
    : sendJson(`/api/admin/cs/articles/${body.id}`, "PUT", body);
}

export function deleteCsArticle(id: number): Promise<{ ok: boolean }> {
  return sendJson(`/api/admin/cs/articles/${id}`, "DELETE");
}

interface CsConversation {
  session_id: string;
  msg_count: number;
  last_at: string;
  first_question: string;
}

interface ConvMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** 客服管理:知识库文章 + 重建索引 + 会话记录 + 快捷提问 */
export function CsSection() {
  const [articles, setArticles] = useState<CsArticle[] | null>(null);
  const [draft, setDraft] = useState<
    { id: number | null; title: string; content_md: string; enabled: boolean } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [convs, setConvs] = useState<CsConversation[]>([]);
  const [convDetail, setConvDetail] = useState<ConvMessage[] | null>(null);
  const [chips, setChips] = useState<{ id: number; text: string }[]>([]);
  const [newChip, setNewChip] = useState("");

  const load = () => {
    fetchCsArticles().then(setArticles).catch(() => setArticles([]));
    getJson<{ items: CsConversation[] }>("/api/admin/cs/conversations")
      .then((d) => setConvs(d.items))
      .catch(() => setConvs([]));
    getJson<{ items: { id: number; text: string }[] }>("/api/admin/quick-questions")
      .then((d) => setChips(d.items))
      .catch(() => setChips([]));
  };
  useEffect(load, []);

  const save = async () => {
    if (!draft?.title.trim()) return;
    setBusy(true);
    try {
      await saveCsArticle(draft);
      setDraft(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (a: CsArticle) => {
    await saveCsArticle({
      id: a.id,
      title: a.title,
      content_md: a.content_md,
      enabled: a.enabled === 0,
    });
    load();
  };

  const reindex = async () => {
    setBusy(true);
    setNotice("");
    try {
      const d = await sendJson<{ chunks: number }>("/api/admin/cs/reindex", "POST");
      setNotice(`重建完成,共 ${d.chunks} 个分块(向量同步在后台异步生效)。`);
      load();
    } catch {
      setNotice("重建失败,请重试。");
    } finally {
      setBusy(false);
    }
  };

  const viewConv = async (sid: string) => {
    const d = await getJson<{ items: ConvMessage[] }>(
      `/api/admin/cs/conversations/${sid}`,
    );
    setConvDetail(d.items);
  };

  return (
    <div className="space-y-10">
      {/* 知识库文章 */}
      <section>
        <h2 className="flex items-center justify-between text-lg font-semibold">
          🤖 AI 客服知识库
          <span className="flex gap-2">
            <button
              onClick={reindex}
              disabled={busy}
              className="rounded-card border border-line px-3 py-1.5 text-sm transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
            >
              重建索引
            </button>
            <button
              onClick={() =>
                setDraft({ id: null, title: "", content_md: "", enabled: true })
              }
              className="rounded-card bg-brand px-3 py-1.5 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong"
            >
              + 新增文章
            </button>
          </span>
        </h2>
        {notice && <p className="mt-2 text-sm text-accent">{notice}</p>}
        <p className="mt-2 text-xs text-ink-muted">
          访客提问会先在知识库中检索(BM25 + 语义),命中的片段交给 AI 组织回答;知识库没有的内容,客服会如实说不知道。
        </p>

        {draft && (
          <div className="mt-4 rounded-card border border-line bg-surface shadow-card p-5">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="文章标题 *"
              className="w-full rounded-card border border-line bg-base px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <textarea
              value={draft.content_md}
              onChange={(e) => setDraft({ ...draft, content_md: e.target.value })}
              placeholder="文章内容(Markdown)。保存后自动分块、生成向量并进入检索。"
              rows={8}
              className="mt-3 w-full resize-y rounded-card border border-line bg-base px-3 py-2 font-mono text-sm outline-none focus:border-brand"
            />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              />
              启用(参与检索)
            </label>
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
          {articles === null && (
            <div className="h-16 animate-pulse rounded-card bg-raised" />
          )}
          {articles?.length === 0 && (
            <p className="text-sm text-ink-muted">
              还没有知识库文章,客服只能靠兜底话术回答——先加几篇介绍站点/作品的文章吧。
            </p>
          )}
          {articles?.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-card border border-line bg-surface shadow-card px-4 py-3 text-sm"
            >
              <button
                onClick={() => toggleEnabled(a)}
                title="点击切换启用状态"
                className={`shrink-0 rounded-card px-2 py-0.5 text-xs ${
                  a.enabled
                    ? "bg-brand text-onbrand"
                    : "border border-line text-ink-muted"
                }`}
              >
                {a.enabled ? "启用" : "停用"}
              </button>
              <span className="font-medium">{a.title}</span>
              <span className="text-xs text-ink-muted">{a.chunk_count} 块</span>
              <span className="ml-auto flex shrink-0 gap-2 text-xs">
                <button
                  onClick={() =>
                    setDraft({
                      id: a.id,
                      title: a.title,
                      content_md: a.content_md,
                      enabled: a.enabled !== 0,
                    })
                  }
                  className="rounded-card border border-line px-3 py-1 transition-colors hover:border-brand hover:text-brand"
                >
                  编辑
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("确认删除这篇文章?")) return;
                    await deleteCsArticle(a.id);
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

      {/* 快捷提问 */}
      <section>
        <h2 className="text-lg font-semibold">💬 快捷提问 chips</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1.5 rounded-card border border-line bg-surface shadow-card px-3 py-1.5 text-sm"
            >
              {c.text}
              <button
                onClick={async () => {
                  await sendJson(`/api/admin/quick-questions/${c.id}`, "DELETE");
                  load();
                }}
                className="text-ink-muted hover:text-accent"
                aria-label={`删除 ${c.text}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newChip.trim()) return;
            await sendJson("/api/admin/quick-questions", "POST", {
              text: newChip.trim(),
              sort_order: chips.length,
            });
            setNewChip("");
            load();
          }}
        >
          <input
            value={newChip}
            onChange={(e) => setNewChip(e.target.value)}
            placeholder="新增快捷提问…"
            className="w-64 rounded-card border border-line bg-surface shadow-card px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
          <button className="rounded-card border border-line px-3 py-1.5 text-sm transition-colors hover:border-brand hover:text-brand">
            添加
          </button>
        </form>
      </section>

      {/* 会话记录 */}
      <section>
        <h2 className="text-lg font-semibold">🗂 客服会话记录</h2>
        <p className="mt-1 text-xs text-ink-muted">
          看看访客在问什么、知识库没答上什么,据此补文章。
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {convs.length === 0 && (
              <p className="text-sm text-ink-muted">暂无会话。</p>
            )}
            {convs.map((cv) => (
              <button
                key={cv.session_id}
                onClick={() => viewConv(cv.session_id)}
                className="w-full rounded-card border border-line bg-surface shadow-card px-4 py-3 text-left text-sm transition-colors hover:border-brand"
              >
                <div className="flex justify-between">
                  <span className="truncate font-medium">{cv.first_question}</span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {cv.msg_count} 条
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">{cv.last_at}</p>
              </button>
            ))}
          </div>
          <div className="rounded-card border border-line bg-surface shadow-card p-4">
            {!convDetail && (
              <p className="py-8 text-center text-sm text-ink-muted">
                点击左侧会话查看完整对话。
              </p>
            )}
            {convDetail && (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {convDetail.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-card px-3 py-2 text-sm ${
                      m.role === "user"
                        ? "bg-raised"
                        : "border border-line text-ink-muted"
                    }`}
                  >
                    <span className="mr-2 text-xs font-medium">
                      {m.role === "user" ? "访客" : "客服"}
                    </span>
                    {m.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
