import { Hono } from "hono";
import type { Env } from "@shared/env";
import { handleChat } from "../cs/chat";
import { rateLimit, clientIp } from "../ratelimit";

interface QuickQuestionRow {
  id: number;
  text: string;
}

export function chatRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  // 快捷提问 chips(公开)
  app.get("/api/chat/quick-questions", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT id, text FROM quick_questions WHERE enabled = 1 ORDER BY sort_order ASC, id ASC`,
    ).all<QuickQuestionRow>();
    return c.json({ items: (results ?? []).map((r) => r.text) });
  });

  // 对话(公开,SSE 流式;限流 20 次/小时/IP)
  app.post("/api/chat", async (c) => {
    if (!(await rateLimit(c.env, `chat:${clientIp(c)}`, 20, 3600))) {
      return c.json(
        { error: "你今天问得有点多啦,请一小时后再来找我聊 😅" },
        429,
      );
    }
    const body = (await c.req.json().catch(() => ({}))) as {
      sessionId?: string;
      message?: string;
    };
    const sessionId = (body.sessionId || "").trim();
    const message = (body.message || "").trim();
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(sessionId)) {
      return c.json({ error: "invalid session" }, 400);
    }
    if (!message) return c.json({ error: "消息不能为空" }, 400);
    if (message.length > 2000) {
      return c.json({ error: "单条消息不能超过 2000 字" }, 400);
    }
    return handleChat(c.env, sessionId, message);
  });

  return app;
}
