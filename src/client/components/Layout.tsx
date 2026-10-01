import { lazy, Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ChatWidget } from "@/components/ChatWidget";
import { ScrollProgress } from "@/motion";
import { useTheme, type ThemeId } from "@/theme";

/** 「3D 深空」场景:懒加载,仅在该主题激活时下载 three.js chunk */
const SpaceScene = lazy(() => import("@/components/SpaceScene"));
/** 「机械纪元」场景:懒加载(NieR: Automata 废墟 3D 场景) */
const NieRScene = lazy(() => import("@/components/NieRScene"));
/** 「水色玻璃」装饰场景:纯 CSS,无懒加载需要 */
import AquaScene from "@/components/AquaScene";

const NAV = [
  { to: "/", label: "首页" },
  { to: "/portfolio", label: "作品" },
  { to: "/blog", label: "博客" },
  { to: "/about", label: "关于" },
  { to: "/prompts", label: "提示词" },
  { to: "/daily", label: "AI 日报" },
  { to: "/knowledge", label: "知识库" },
  { to: "/admin", label: "后台" },
];

/** 每套主题自己的版式性格:游戏主题全屏沉浸,其余居中阅读 */
const MAIN_LAYOUT: Record<ThemeId, string> = {
  aurora: "mx-auto max-w-5xl px-4 py-10",
  swiss: "mx-auto max-w-5xl px-4 py-10",
  terminal: "mx-auto max-w-5xl px-4 py-10",
  inkwarm: "mx-auto max-w-5xl px-4 py-10",
  bento: "mx-auto max-w-5xl px-4 py-10",
  brutal: "mx-auto max-w-5xl px-4 py-10",
  // 格斗:全屏贴边,分区靠卡片与斜切
  fighter: "max-w-none px-3 py-10 md:px-8",
  // HUD:给左右竖轨让位,内容全宽
  cyberpunk: "max-w-none px-10 py-10 md:px-20",
  // 街机:收窄一点更玩具感
  arcade: "mx-auto max-w-4xl px-4 py-8",
  // 深空 3D:居中阅读,沉浸感交给全屏 3D 场景
  // 深空 3D:全屏沉浸,场景即背景
  space: "max-w-none px-4 py-10 md:px-12",
  // 机械纪元:居中极简,沉浸感交给全屏废墟场景
  nier: "mx-auto max-w-5xl px-4 py-10",
  // 水色玻璃:居中留白,漂浮几何做背景
  aqua: "mx-auto max-w-6xl px-4 py-10",
};

/** 路由切换时整页浮现(key 变化触发 page-in 动画) */
function AnimatedOutlet() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter">
      <Outlet />
    </div>
  );
}

export function Layout() {
  const { theme } = useTheme();
  return (
    <div className="min-h-dvh bg-base text-ink">
      <ScrollProgress />
      {theme === "cyberpunk" && (
        <>
          <div className="hud-rail hud-rail-left" aria-hidden>
            SYSTEM ONLINE · WATCHDOG OK
          </div>
          <div className="hud-rail hud-rail-right" aria-hidden>
            NIGHT CITY LINK · 2077
          </div>
        </>
      )}
      {theme === "space" && (
        <Suspense fallback={null}>
          <SpaceScene />
        </Suspense>
      )}
      {theme === "nier" && (
        <Suspense fallback={null}>
          <NieRScene />
        </Suspense>
      )}
      {theme === "aqua" && <AquaScene />}
      <header className="sticky top-0 z-40 border-b border-line bg-base/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <NavLink to="/" className="text-base font-bold tracking-tight">
            Jay<span className="text-brand"> · AI 站</span>
          </NavLink>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-link rounded-card px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-raised font-medium text-brand"
                      : "text-ink-muted hover:bg-raised hover:text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
          </div>
        </div>
        {/* 移动端导航 */}
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `shrink-0 rounded-card px-3 py-1 text-sm transition-colors ${
                  isActive ? "bg-raised font-medium text-brand" : "text-ink-muted"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={`relative z-10 ${MAIN_LAYOUT[theme]}`}>
        <AnimatedOutlet />
      </main>

      <ChatWidget />

      <footer className="relative z-10 border-t border-line py-6 text-center text-sm text-ink-muted">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4">
          <a
            href="https://github.com/fantiny"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-brand"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            GitHub
          </a>
          <span aria-hidden>·</span>
          <span>
            © {new Date().getFullYear()} Jay · Powered by Cloudflare Workers
          </span>
        </div>
      </footer>
    </div>
  );
}
