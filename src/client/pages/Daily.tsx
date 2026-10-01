import { useCallback, useEffect, useState } from "react";
import { fetchDigest, fetchDigestList } from "@/api";
import { renderMarkdown } from "@/markdown";
import { Reveal } from "@/motion";
import type { DigestDetail, DigestListItem } from "@shared/types";

export function Daily() {
  const [dates, setDates] = useState<DigestListItem[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [detail, setDetail] = useState<DigestDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDigestList()
      .then((list) => {
        setDates(list);
        if (list.length > 0) setActive(list[0].date);
      })
      .catch(() => setDates([]));
  }, []);

  const load = useCallback((date: string) => {
    setLoading(true);
    setDetail(null);
    fetchDigest(date)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (active) load(active);
  }, [active, load]);

  return (
    <div>
      <h1 className="text-2xl font-bold">每日 AI 日报</h1>
      <p className="mt-2 text-sm text-ink-muted">
        每天早上 8 点自动抓取 AI 资讯源,由 AI 汇总生成。
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(dates ?? []).map((d) => (
          <button
            key={d.date}
            onClick={() => setActive(d.date)}
            className={`rounded-card border px-3 py-1.5 text-sm transition-colors ${
              d.date === active
                ? "border-brand bg-raised font-medium text-brand"
                : "border-line text-ink-muted hover:border-brand hover:text-ink"
            }`}
          >
            {d.date}
          </button>
        ))}
        {dates?.length === 0 && (
          <p className="text-sm text-ink-muted">还没有日报,明天早上来看看。</p>
        )}
      </div>

      {loading && (
        <div className="mt-6 h-40 animate-pulse rounded-card bg-raised" />
      )}

      {detail && !loading && (
        <div className="mt-6 space-y-6">
          <Reveal>
          <section className="rounded-card border border-line bg-surface shadow-card p-6">
            <h2 className="text-lg font-semibold">
              {detail.date} 综述{" "}
              <span className="text-sm font-normal text-ink-muted">
                ({detail.itemCount} 条)
              </span>
            </h2>
            <div
              className="digest-prose mt-3 max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(detail.summaryMd) }}
            />
          </section>
          </Reveal>

          <Reveal delay={120}>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">今日资讯</h2>
            {detail.items.map((n) => (
              <article
                key={n.id}
                className="hover-lift rounded-card border border-line bg-surface shadow-card p-5"
              >
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <span className="rounded-card bg-raised px-2 py-0.5 font-medium">
                    {n.source}
                  </span>
                  {n.publishedAt && <span>{n.publishedAt.slice(0, 10)}</span>}
                </div>
                <a
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block font-medium leading-snug hover:text-brand"
                >
                  {n.title} ↗
                </a>
                {n.aiSummary && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {n.aiSummary}
                  </p>
                )}
              </article>
            ))}
          </section>
          </Reveal>
        </div>
      )}
    </div>
  );
}
