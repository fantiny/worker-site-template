import { THEMES, useTheme } from "@/theme";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">选择主题</span>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as (typeof THEMES)[number]["id"])}
        className="appearance-none rounded-card border border-line bg-surface py-1.5 pl-3 pr-8 text-sm text-ink outline-none transition-colors hover:border-brand focus:border-brand"
        aria-label="一键换肤"
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            🎨 {t.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-ink-muted"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden
      >
        <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </label>
  );
}
