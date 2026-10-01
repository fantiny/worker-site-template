import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDigestList, fetchDigest, fetchPortfolio } from "@/api";
import { Reveal, spotlightHandlers } from "@/motion";
import { renderMarkdown } from "@/markdown";
import type { DigestDetail, PortfolioItem } from "@shared/types";

export function Home() {
  const [items, setItems] = useState<PortfolioItem[] | null>(null);
  const [latest, setLatest] = useState<DigestDetail | null>(null);

  useEffect(() => {
    fetchPortfolio().then(setItems).catch(() => setItems([]));
    fetchDigestList()
      .then((list) => {
        if (list.length > 0) return fetchDigest(list[0].date).then(setLatest);
        setLatest(null);
      })
      .catch(() => setLatest(null));
  }, []);

  return (
    <div className="space-y-12">
      <Reveal>
      <section className="rounded-card border border-line bg-surface shadow-card p-8">
        <p className="text-sm font-medium tracking-wide text-accent">Hello, I'm Jay 👋</p>
        <h1 className="mt-2 text-3xl font-bold leading-snug md:text-4xl">
          在这里<span className="text-gradient">折腾 AI</span>:
          <br />
          知识库、提示词、每日资讯与作品。
        </h1>
        <p className="mt-4 max-w-2xl text-ink-muted">
          这是我的个人 AI 站点,部署在 Cloudflare Workers 上。
          右下角有 AI 客服,可以随时向我提问;顶栏可一键切换主题。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/portfolio"
            className="pressable rounded-card bg-brand px-5 py-2 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong"
          >
            看看我的作品
          </Link>
          <Link
            to="/prompts"
            className="pressable rounded-card border border-line px-5 py-2 text-sm font-medium transition-colors hover:border-brand hover:text-brand"
          >
            提示词生成工具
          </Link>
        </div>
      </section>
      </Reveal>

      <section>
        <Reveal>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">精选作品</h2>
          <Link to="/portfolio" className="text-sm text-brand hover:underline">
            全部作品 →
          </Link>
        </div>
        </Reveal>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items === null && <SkeletonCards />}
          {items?.length === 0 && (
            <p className="text-sm text-ink-muted">暂无作品数据。</p>
          )}
          {items?.slice(0, 3).map((it, i) => (
            <Reveal key={it.id} delay={i * 90}>
            <Link
              {...spotlightHandlers()}
              to={`/portfolio/${it.id}`}
              className="spotlight hover-lift group block overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors hover:border-brand"
            >
              {it.coverUrl ? (
                <img
                  src={it.coverUrl}
                  alt={it.title}
                  className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-28 items-center justify-center bg-raised text-3xl">
                  🧩
                </div>
              )}
              <div className="p-5">
                <h3 className="font-semibold group-hover:text-brand">{it.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                  {it.description}
                </p>
              </div>
            </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">最新 AI 日报</h2>
          <Link to="/daily" className="text-sm text-brand hover:underline">
            全部日报 →
          </Link>
        </div>
        {latest ? (
          <div className="mt-4 rounded-card border border-line bg-surface shadow-card p-6">
            <p className="text-sm text-ink-muted">
              {latest.date} · {latest.itemCount} 条资讯
            </p>
            <div
              className="digest-prose max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(latest.summaryMd) }}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">日报还在路上,敬请期待。</p>
        )}
      </section>
      </Reveal>
    </div>
  );
}

function SkeletonCards() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-card bg-raised" />
      ))}
    </>
  );
}
