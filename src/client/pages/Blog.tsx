import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPosts, type PostListItem } from "@/api";
import { Reveal, spotlightHandlers } from "@/motion";

export function Blog() {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPosts().then(setPosts).catch(() => setError(true));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">博客</h1>
      <p className="mt-2 text-sm text-ink-muted">
        写写技术、折腾与思考。
      </p>

      {error && <p className="mt-8 text-sm text-accent">加载失败,请稍后重试。</p>}
      {posts === null && !error && (
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-raised" />
          ))}
        </div>
      )}
      {posts?.length === 0 && (
        <p className="mt-8 text-sm text-ink-muted">还没有文章,敬请期待。</p>
      )}

      <div className="mt-8 space-y-4">
        {posts?.map((p, i) => (
          <Reveal key={p.id} delay={Math.min(i, 4) * 80}>
            <Link
              {...spotlightHandlers()}
              to={`/blog/${p.slug}`}
              className="spotlight hover-lift block rounded-card border border-line bg-surface shadow-card p-5 transition-colors hover:border-brand"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold group-hover:text-brand">
                  {p.title}
                </h2>
                <span className="text-xs text-ink-muted">
                  {(p.publishedAt || p.createdAt).slice(0, 10)}
                </span>
              </div>
              {p.summary && (
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {p.summary}
                </p>
              )}
              {p.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-card bg-raised px-2 py-0.5 text-xs text-ink-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
