import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LoginGate } from "@/auth";
import { CsSection } from "@/components/admin-cs";
import { PostsSection, AboutSection } from "@/components/admin-cms";
import {
  deleteAdminPortfolio,
  fetchAdminPortfolio,
  saveAdminPortfolio,
  sendJson,
  getJson,
  type AdminPortfolioItem,
} from "@/api";

/* ============ 作品管理 ============ */

interface Draft {
  id: number | null;
  title: string;
  description: string;
  techStack: string;
  coverUrl: string;
  links: string;
  sortOrder: number;
  visible: boolean;
  detailMd: string;
}

function toDraft(item?: AdminPortfolioItem): Draft {
  return {
    id: item?.id ?? null,
    title: item?.title ?? "",
    description: item?.description ?? "",
    techStack: item?.techStack.join(", ") ?? "",
    coverUrl: item?.coverUrl ?? "",
    links: (item?.links ?? []).map((l) => `${l.label} | ${l.url}`).join("\n"),
    sortOrder: item?.sortOrder ?? 0,
    visible: item?.visible ?? true,
    detailMd: item?.detailMd ?? "",
  };
}

function PortfolioSection() {
  const [items, setItems] = useState<AdminPortfolioItem[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetchAdminPortfolio()
      .then(setItems)
      .catch(() => setItems([]));

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!draft?.title.trim()) return;
    setBusy(true);
    try {
      const links = draft.links
        .split("\n")
        .map((line) => line.split("|").map((s) => s.trim()))
        .filter((p) => p[0] && p[1])
        .map((p) => ({ label: p[0], url: p[1] }));
      await saveAdminPortfolio(
        {
          id: draft.id ?? 0,
          title: draft.title.trim(),
          description: draft.description,
          coverUrl: draft.coverUrl,
          links,
          techStack: draft.techStack
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
          sortOrder: draft.sortOrder,
          visible: draft.visible,
          detailMd: draft.detailMd,
        },
        draft.id === null,
      );
      setDraft(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("确认删除这个作品?")) return;
    await deleteAdminPortfolio(id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">🖼 作品管理</h2>
        <button
          onClick={() => setDraft(toDraft())}
          className="pressable rounded-card bg-brand px-4 py-1.5 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong"
        >
          + 新增作品
        </button>
      </div>

      {/* 编辑表单 */}
      {draft && (
        <div className="mt-4 rounded-card border border-line bg-surface shadow-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="作品名称 *"
              className="rounded-card border border-line bg-base px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <input
              value={draft.coverUrl}
              onChange={(e) => setDraft({ ...draft, coverUrl: e.target.value })}
              placeholder="封面图 URL(如 /shots/xxx.jpg)"
              className="rounded-card border border-line bg-base px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="作品描述"
            rows={3}
            className="mt-3 w-full rounded-card border border-line bg-base px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={draft.techStack}
              onChange={(e) => setDraft({ ...draft, techStack: e.target.value })}
              placeholder="技术栈(逗号分隔)"
              className="rounded-card border border-line bg-base px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.visible}
                  onChange={(e) => setDraft({ ...draft, visible: e.target.checked })}
                />
                公开可见
              </label>
              <label className="flex items-center gap-2">
                排序
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) =>
                    setDraft({ ...draft, sortOrder: Number(e.target.value) })
                  }
                  className="w-16 rounded-card border border-line bg-base px-2 py-1 outline-none focus:border-brand"
                />
              </label>
            </div>
          </div>
          <textarea
            value={draft.links}
            onChange={(e) => setDraft({ ...draft, links: e.target.value })}
            placeholder={"链接(每行一条):标签 | URL"}
            rows={2}
            className="mt-3 w-full rounded-card border border-line bg-base px-3 py-2 font-mono text-sm outline-none focus:border-brand"
          />
          <textarea
            value={draft.detailMd}
            onChange={(e) => setDraft({ ...draft, detailMd: e.target.value })}
            placeholder="作品详细介绍(Markdown,点击卡片进入的详情页内容)"
            rows={8}
            className="mt-3 w-full resize-y rounded-card border border-line bg-base px-3 py-2 font-mono text-sm outline-none focus:border-brand"
          />
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

      {/* 列表 */}
      <div className="mt-4 space-y-2">
        {items === null && (
          <div className="h-20 animate-pulse rounded-card bg-raised" />
        )}
        {items?.length === 0 && <p className="text-sm text-ink-muted">暂无作品。</p>}
        {items?.map((it) => (
          <div
            key={it.id}
            className="flex items-center gap-3 rounded-card border border-line bg-surface shadow-card px-4 py-3"
          >
            <span className="text-xs text-ink-muted">#{it.sortOrder}</span>
            <span className={`font-medium ${it.visible ? "" : "text-ink-muted line-through"}`}>
              {it.title}
            </span>
            <span className="truncate text-xs text-ink-muted">{it.description}</span>
            <span className="ml-auto flex shrink-0 gap-2 text-xs">
              <button
                onClick={() => setDraft(toDraft(it))}
                className="rounded-card border border-line px-3 py-1 transition-colors hover:border-brand hover:text-brand"
              >
                编辑
              </button>
              <button
                onClick={() => remove(it.id)}
                className="rounded-card border border-line px-3 py-1 transition-colors hover:border-accent hover:text-accent"
              >
                删除
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ RSS 源与日报 ============ */

interface FeedSource {
  id: number;
  name: string;
  url: string;
  enabled: number;
}

function FeedSection() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [running, setRunning] = useState(false);

  const load = () =>
    getJson<{ items: FeedSource[] }>("/api/admin/feed-sources")
      .then((d) => setSources(d.items))
      .catch(() => setSources([]));

  useEffect(() => {
    load();
  }, []);

  const runDigest = async () => {
    setRunning(true);
    setNotice("");
    try {
      const d = await sendJson<{ date: string; inserted: number; sourcesFetched: number; llmUsed: boolean }>(
        "/api/admin/digest/run",
        "POST",
      );
      setNotice(
        `✅ ${d.date} 日报已生成:抓取 ${d.sourcesFetched} 个源,新增 ${d.inserted} 条${
          d.llmUsed ? "(AI 已摘要)" : "(AI 未接入,使用原文摘要兜底)"
        }。`,
      );
    } catch {
      setNotice("❌ 日报生成失败,请稍后重试或查看 Worker 日志。");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">📡 RSS 源与日报</h2>
        <button
          onClick={runDigest}
          disabled={running}
          className="pressable rounded-card bg-brand px-3 py-1.5 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {running ? "生成中…" : "立即生成今日日报"}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        每天北京时间 08:00 自动生成;也可在此手动触发(同一 URL 当天自动去重)。
      </p>
      {notice && <p className="mt-2 text-sm text-accent">{notice}</p>}

      <div className="mt-4 space-y-2">
        {sources.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-card border border-line bg-surface shadow-card px-4 py-2.5 text-sm"
          >
            <button
              onClick={async () => {
                await sendJson(`/api/admin/feed-sources/${s.id}`, "PUT", {
                  enabled: s.enabled === 0,
                });
                load();
              }}
              className={`shrink-0 rounded-card px-2 py-0.5 text-xs ${
                s.enabled ? "bg-brand text-onbrand" : "border border-line text-ink-muted"
              }`}
            >
              {s.enabled ? "启用" : "停用"}
            </button>
            <span className="font-medium">{s.name}</span>
            <span className="truncate text-xs text-ink-muted">{s.url}</span>
            <button
              onClick={async () => {
                if (!confirm(`删除源「${s.name}」?`)) return;
                await sendJson(`/api/admin/feed-sources/${s.id}`, "DELETE");
                load();
              }}
              className="ml-auto shrink-0 text-xs text-ink-muted hover:text-accent"
            >
              删除
            </button>
          </div>
        ))}
      </div>

      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || !url.trim()) return;
          try {
            await sendJson("/api/admin/feed-sources", "POST", {
              name: name.trim(),
              url: url.trim(),
            });
            setName("");
            setUrl("");
            load();
          } catch {
            alert("添加失败:URL 可能已存在或格式不合法。");
          }
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="源名称(如:机器之心)"
          className="w-40 rounded-card border border-line bg-base px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="RSS/Atom URL"
          className="min-w-64 flex-1 rounded-card border border-line bg-base px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
        <button className="rounded-card border border-line px-3 py-1.5 text-sm transition-colors hover:border-brand hover:text-brand">
          添加源
        </button>
      </form>
    </div>
  );
}

/* ============ Dashboard 外壳:左侧菜单 + 右侧内容 ============ */

const MENU = [
  { id: "portfolio", label: "作品管理" },
  { id: "posts", label: "博客文章" },
  { id: "cs", label: "AI 客服" },
  { id: "feed", label: "RSS 与日报" },
  { id: "about", label: "关于页" },
] as const;

type MenuId = (typeof MENU)[number]["id"];

function AdminDashboard() {
  const [active, setActive] = useState<MenuId>("portfolio");

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
      {/* 左侧菜单:桌面为竖向 sticky 面板,移动端为横向滑动条 */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-card border border-line bg-surface shadow-card p-3">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-widest text-ink-muted">
            Dashboard
          </p>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {MENU.map((m) => (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`shrink-0 rounded-card px-3 py-2 text-left text-sm transition-colors lg:w-full ${
                  active === m.id
                    ? "bg-raised font-medium text-brand"
                    : "text-ink-muted hover:bg-raised hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
            <div className="hidden border-t border-line pt-2 lg:block">
              <Link
                to="/knowledge"
                className="block rounded-card px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-brand"
              >
                📚 个人知识库 ↗
              </Link>
            </div>
          </nav>
        </div>
        <div className="mt-3 hidden lg:block">
          <Link
            to="/"
            className="block px-2 text-xs text-ink-muted transition-colors hover:text-brand"
          >
            ← 返回站点首页
          </Link>
        </div>
      </aside>

      {/* 右侧内容 */}
      <section className="mt-6 min-w-0 lg:mt-0">
        {active === "portfolio" && <PortfolioSection />}
        {active === "posts" && <PostsSection />}
        {active === "cs" && <CsSection />}
        {active === "feed" && <FeedSection />}
        {active === "about" && <AboutSection />}
      </section>
    </div>
  );
}

export function Admin() {
  return (
    <LoginGate>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">管理后台</h1>
        <Link
          to="/knowledge"
          className="text-sm text-ink-muted transition-colors hover:text-brand lg:hidden"
        >
          📚 个人知识库
        </Link>
      </div>
      <AdminDashboard />
    </LoginGate>
  );
}
