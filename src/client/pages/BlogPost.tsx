import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchPost, type PostDetail } from "@/api";
import { renderMarkdown } from "@/markdown";

export function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetchPost(slug)
      .then(setPost)
      .catch(() => setError(true));
  }, [slug]);

  if (error) {
    return (
      <div className="py-20 text-center text-ink-muted">
        文章不存在或未发布。
        <div className="mt-4">
          <Link to="/blog" className="text-brand hover:underline">
            ← 返回博客
          </Link>
        </div>
      </div>
    );
  }

  if (!post) {
    return <div className="h-64 animate-pulse rounded-card bg-raised" />;
  }

  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/blog" className="text-sm text-brand hover:underline">
        ← 博客
      </Link>
      <header className="mt-4">
        <h1 className="text-3xl font-bold leading-snug">{post.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {(post.publishedAt || post.createdAt).slice(0, 10)}
          {post.tags.length > 0 && (
            <span className="ml-3 inline-flex gap-1.5">
              {post.tags.map((t) => (
                <span key={t} className="rounded-card bg-raised px-2 py-0.5 text-xs">
                  {t}
                </span>
              ))}
            </span>
          )}
        </p>
      </header>
      <div
        className="prose mt-8 max-w-none border-t border-line pt-8 text-[15px] leading-relaxed [&_h1]:mb-3 [&_h1]:mt-8 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-card [&_pre]:bg-raised [&_pre]:p-4 [&_pre]:text-sm [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:text-ink-muted [&_code]:text-xs [&_a]:text-brand [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.contentMd) }}
      />
    </article>
  );
}
