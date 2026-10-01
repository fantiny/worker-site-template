import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchPortfolioItem } from "@/api";
import { renderMarkdown } from "@/markdown";
import type { PortfolioItem } from "@shared/types";

export function PortfolioDetail() {
  const { id } = useParams();
  const [item, setItem] = useState<(PortfolioItem & { detailMd: string }) | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchPortfolioItem(id)
      .then(setItem)
      .catch(() => setError(true));
  }, [id]);

  if (error) {
    return (
      <div className="py-20 text-center text-ink-muted">
        作品不存在或已下线。
        <div className="mt-4">
          <Link to="/portfolio" className="text-brand hover:underline">
            ← 返回作品列表
          </Link>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <div className="h-72 animate-pulse rounded-card bg-raised" />
        <div className="h-8 w-2/3 animate-pulse rounded-card bg-raised" />
        <div className="h-24 animate-pulse rounded-card bg-raised" />
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-4xl">
      {/* 顶部:返回 + 封面 hero */}
      <Link to="/portfolio" className="text-sm text-brand hover:underline">
        ← 全部作品
      </Link>

      <div className="relative mt-4 overflow-hidden rounded-card border border-line shadow-card">
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={`${item.title} 配图`}
            className="h-64 w-full object-cover md:h-96"
          />
        ) : (
          <div className="flex h-64 w-full items-center justify-center bg-raised text-6xl md:h-96">
            🧩
          </div>
        )}
        {/* 底部渐晕,让画面过渡自然 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
      </div>

      {/* 标题区 */}
      <header className="mt-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Portfolio
        </p>
        <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
          {item.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-muted">
          {item.description}
        </p>
      </header>

      {/* 信息面板:技术栈 + 链接 */}
      {(item.techStack.length > 0 || item.links.length > 0) && (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
          {item.techStack.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.techStack.map((t) => (
                <span
                  key={t}
                  className="rounded-card bg-raised px-2.5 py-1 text-xs text-ink-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {item.links.length > 0 && (
            <div className="ml-auto flex flex-wrap gap-2">
              {item.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-card bg-brand px-4 py-2 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong"
                >
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 正文 */}
      {item.detailMd ? (
        <div
          className="prose mt-10 max-w-none border-t border-line pt-8 text-[15px] leading-loose [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:border-l-4 [&_h2]:border-brand [&_h2]:pb-1 [&_h2]:pl-3 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-1.5 [&_li]:marker:text-brand [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-card [&_pre]:bg-raised [&_pre]:p-4 [&_pre]:text-sm [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-raised [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:text-ink-muted [&_code]:text-xs [&_a]:text-brand [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(item.detailMd) }}
        />
      ) : (
        <p className="mt-10 border-t border-line pt-8 text-sm text-ink-muted">
          详细介绍待补充。
        </p>
      )}

      {/* 页尾 */}
      <div className="mt-12 flex justify-between border-t border-line pt-6 text-sm">
        <Link to="/portfolio" className="text-brand hover:underline">
          ← 更多作品
        </Link>
        <Link to="/" className="text-ink-muted hover:text-brand">
          回到首页 →
        </Link>
      </div>
    </article>
  );
}
