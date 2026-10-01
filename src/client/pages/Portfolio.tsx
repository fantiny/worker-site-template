import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPortfolio } from "@/api";
import { Reveal, spotlightHandlers } from "@/motion";
import type { PortfolioItem } from "@shared/types";

export function Portfolio() {
  const [items, setItems] = useState<PortfolioItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPortfolio().then(setItems).catch(() => setError(true));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">作品展示</h1>
      <p className="mt-2 text-sm text-ink-muted">
        我做过的一些东西:开源项目、部署的站点和实验性玩具。
      </p>

      {error && (
        <p className="mt-8 text-sm text-accent">加载失败,请稍后重试。</p>
      )}
      {items === null && !error && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-card bg-raised" />
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {items?.map((it, i) => (
          <Reveal key={it.id} delay={(i % 2) * 90}>
          <Link
            {...spotlightHandlers()}
            to={`/portfolio/${it.id}`}
            className="spotlight hover-lift group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors hover:border-brand"
          >
            {it.coverUrl ? (
              <img
                src={it.coverUrl}
                alt={it.title}
                className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-40 items-center justify-center bg-raised text-4xl">
                🧩
              </div>
            )}
            <div className="flex flex-1 flex-col p-5">
              <h2 className="font-semibold group-hover:text-brand">{it.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">
                {it.description}
              </p>
              {it.techStack.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {it.techStack.map((t) => (
                    <span
                      key={t}
                      className="rounded-card bg-raised px-2 py-0.5 text-xs text-ink-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <span className="mt-4 text-sm font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                查看详细介绍 →
              </span>
            </div>
          </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
