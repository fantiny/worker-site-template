import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-6xl font-bold text-brand">404</p>
      <p className="mt-4 text-ink-muted">页面不存在或已被移动。</p>
      <Link to="/" className="mt-6 inline-block rounded-card bg-brand px-5 py-2 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong">
        回到首页
      </Link>
    </div>
  );
}
