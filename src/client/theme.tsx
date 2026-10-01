import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const THEMES = [
  { id: "nier", label: "机械纪元" },
  { id: "aurora", label: "极光玻璃" },
  { id: "swiss", label: "瑞士极简" },
  { id: "terminal", label: "赛博终端" },
  { id: "inkwarm", label: "墨韵宣纸" },
  { id: "bento", label: "便当格" },
  { id: "brutal", label: "新粗野" },
  { id: "fighter", label: "格斗战场" },
  { id: "cyberpunk", label: "赛博 HUD" },
  { id: "arcade", label: "糖果街机" },
  { id: "space", label: "3D 深空" },
  { id: "aqua", label: "水色玻璃" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
const STORAGE_KEY = "paih:theme";

function isThemeId(v: string | undefined): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

function currentTheme(): ThemeId {
  const cur = document.documentElement.dataset.theme;
  return isThemeId(cur) ? cur : "aurora";
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(currentTheme);

  const setTheme = useCallback((t: ThemeId) => {
    const apply = () => {
      document.documentElement.dataset.theme = t;
      try {
        localStorage.setItem(STORAGE_KEY, t);
      } catch {
        /* 隐私模式下 localStorage 不可用,忽略 */
      }
    };
    // 主题切换:View Transition 交叉淡化(不支持的浏览器直接切换)
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (doc.startViewTransition) {
      doc.startViewTransition(apply);
    } else {
      apply();
    }
    setThemeState(t);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
