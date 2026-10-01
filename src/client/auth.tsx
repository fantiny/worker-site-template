import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface AuthContextValue {
  /** null = 检查中;true/false = 是否已登录 */
  authed: boolean | null;
  refresh: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = (await res.json()) as { authenticated: boolean };
      setAuthed(data.authenticated);
    } catch {
      setAuthed(false);
    }
  }, []);

  const login = useCallback(async (token: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `登录失败 (${res.status})`);
    }
    setAuthed(true);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuthed(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ authed, refresh, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** 未登录时显示登录卡片;检查中显示骨架 */
export function LoginGate({ children }: { children: ReactNode }) {
  const { authed, login, logout } = useAuth();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (authed === null) {
    return <div className="h-40 animate-pulse rounded-card bg-raised" />;
  }

  if (!authed) {
    return (
      <div className="mx-auto mt-10 max-w-sm rounded-card border border-line bg-surface p-6">
        <h1 className="text-lg font-semibold">站主登录</h1>
        <p className="mt-1 text-sm text-ink-muted">
          输入管理密钥以访问私有区域。
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await login(token.trim());
            } catch (err) {
              setError(err instanceof Error ? err.message : "登录失败");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="管理密钥"
            autoFocus
            className="w-full rounded-card border border-line bg-base px-3 py-2 text-sm outline-none focus:border-brand"
          />
          {error && <p className="text-sm text-accent">{error}</p>}
          <button
            type="submit"
            disabled={busy || !token.trim()}
            className="w-full rounded-card bg-brand px-4 py-2 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong disabled:opacity-50"
          >
            {busy ? "登录中…" : "登录"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      {children}
      <div className="mt-10 text-right">
        <button
          onClick={() => logout()}
          className="text-xs text-ink-muted hover:text-accent"
        >
          退出登录
        </button>
      </div>
    </>
  );
}
