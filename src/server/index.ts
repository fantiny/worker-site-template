import { Hono } from "hono";
import type { Env } from "@shared/env";
import {
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
  safeEqual,
  isAuthenticated,
} from "./auth";
import { portfolioRoutes } from "./routes/portfolio";
import { digestRoutes } from "./routes/digest";
import { knowledgeRoutes } from "./routes/knowledge";
import { adminRoutes } from "./routes/admin";
import { promptRoutes } from "./routes/prompts";
import { chatRoutes } from "./routes/chat";
import { csAdminRoutes } from "./routes/cs-admin";
import { postRoutes } from "./routes/posts";
import { runDigest } from "./cron/digest";

const app = new Hono<{ Bindings: Env }>();

app.route("/", portfolioRoutes());
app.route("/", digestRoutes());
app.route("/", knowledgeRoutes());
app.route("/", adminRoutes());
app.route("/", promptRoutes());
app.route("/", chatRoutes());
app.route("/", csAdminRoutes());
app.route("/", postRoutes());

// ---------- 鉴权 ----------
app.post("/api/auth/login", async (c) => {
  const secret = c.env.ADMIN_TOKEN;
  if (!secret) return c.json({ error: "ADMIN_TOKEN not configured" }, 503);
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  if (!body.token || !(await safeEqual(body.token, secret))) {
    return c.json({ error: "token 不正确" }, 401);
  }
  await setSessionCookie(c);
  return c.json({ ok: true });
});

app.post("/api/auth/logout", (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) =>
  c.json({ authenticated: await isAuthenticated(c) }),
);

app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }));

// API 路由集中挂载在 /api/* 下;未知 API 路径返回 404 JSON,
// 其余全部交给静态资产(ASSETS.fetch 内部按 not_found_handling 处理 SPA)。
app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // 每日日报:抓取 AI 资讯 → LLM 摘要 + 综述 → 写 D1
    ctx.waitUntil(
      runDigest(env).then((r) =>
        console.log(
          `digest done: ${r.date} sources=${r.sourcesFetched} inserted=${r.inserted} llm=${r.llmUsed}`,
        ),
      ),
    );
  },
};
