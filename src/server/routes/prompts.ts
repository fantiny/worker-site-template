import { Hono } from "hono";
import type { Env } from "@shared/env";
import { getProvider, AIDataUnavailableError } from "../ai/provider";
import { rateLimit, clientIp } from "../ratelimit";
import { requireAdmin } from "../auth";

export const SCENARIOS = ["通用", "写作", "编程", "分析", "翻译", "学习"] as const;
export const FORMATS = ["不限", "Markdown", "JSON", "表格"] as const;
export const DEPTHS = ["简洁", "适中", "详尽"] as const;

export type PromptScenario = (typeof SCENARIOS)[number];
export type PromptFormat = (typeof FORMATS)[number];
export type PromptDepth = (typeof DEPTHS)[number];

/** 组装提示词生成的 meta-prompt(独立导出便于单测) */
export function buildMetaPrompt(input: {
  idea: string;
  scenario: PromptScenario;
  format: PromptFormat;
  depth: PromptDepth;
  optimize: boolean;
}): { system: string; user: string } {
  const system = [
    "你是一位资深提示词工程师,擅长把模糊的需求改写成高质量、可直接使用的 AI 提示词。",
    "规则:",
    "1. 准确理解用户意图,补全缺失但必要的上下文(角色、任务、约束、输出格式);除用户明确给出的事实外,不要编造具体数据或事实。",
    "2. 只输出最终提示词本身:不要解释你的思路,不要开场白和结尾语。",
    "3. 提示词结构清晰:需要角色设定时给出角色;任务描述具体可执行;明确约束与输出格式。",
    "4. 使用简体中文书写,除非用户的要求本身针对其他语言。",
    `5. 使用场景:${input.scenario};输出格式:${input.format};详细程度:${input.depth}。`,
  ].join("\n");
  const user = input.optimize
    ? `请优化下面这个已有提示词,让它更清晰、更有效:\n\n${input.idea}`
    : `请根据下面的想法写出提示词:\n\n${input.idea}`;
  return { system, user };
}

interface SavedPromptRow {
  id: number;
  kind: string;
  name: string;
  content: string;
  meta_json: string;
  created_at: string;
}

export function promptRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  // 公开:生成提示词(限流 10 次/小时/IP)
  app.post("/api/prompts/generate", async (c) => {
    if (!(await rateLimit(c.env, `prompt:${clientIp(c)}`, 10, 3600))) {
      return c.json({ error: "请求太频繁了,请一小时后再试。" }, 429);
    }
    const body = (await c.req.json().catch(() => ({}))) as {
      idea?: string;
      scenario?: PromptScenario;
      format?: PromptFormat;
      depth?: PromptDepth;
      optimize?: boolean;
    };
    const idea = (body.idea || "").trim();
    if (idea.length < 2) return c.json({ error: "请先描述你的需求" }, 400);
    if (idea.length > 4000) return c.json({ error: "描述过长(上限 4000 字)" }, 400);
    const scenario = SCENARIOS.includes(body.scenario as PromptScenario)
      ? (body.scenario as PromptScenario)
      : "通用";
    const format = FORMATS.includes(body.format as PromptFormat)
      ? (body.format as PromptFormat)
      : "不限";
    const depth = DEPTHS.includes(body.depth as PromptDepth)
      ? (body.depth as PromptDepth)
      : "适中";

    const { system, user } = buildMetaPrompt({
      idea,
      scenario,
      format,
      depth,
      optimize: body.optimize === true,
    });

    try {
      const provider = getProvider(c.env);
      const result = await provider.generate(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { maxTokens: 3000, temperature: 0.6 },
      );
      if (!result.trim()) return c.json({ error: "生成结果为空,请重试" }, 502);
      return c.json({ prompt: result.trim() });
    } catch (e) {
      if (e instanceof AIDataUnavailableError) {
        return c.json({ error: "AI 功能需在部署环境使用(本地未配置 AI 绑定)" }, 503);
      }
      console.error("prompt generate failed:", e);
      return c.json({ error: "生成失败,请稍后重试" }, 502);
    }
  });

  // 管理端:保存 / 列出 / 删除
  app.use("/api/prompts/saved*", requireAdmin);

  app.post("/api/prompts/saved", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      name?: string;
      content?: string;
      meta?: Record<string, unknown>;
    };
    const content = (body.content || "").trim();
    if (!content) return c.json({ error: "content required" }, 400);
    const { meta } = await c.env.DB.prepare(
      `INSERT INTO saved_prompts (name, content, meta_json) VALUES (?, ?, ?)`,
    )
      .bind((body.name || "").trim(), content, JSON.stringify(body.meta ?? {}))
      .run();
    return c.json({ id: Number(meta?.last_row_id) }, 201);
  });

  app.get("/api/prompts/saved", async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT id, kind, name, content, meta_json, created_at
       FROM saved_prompts ORDER BY id DESC LIMIT 100`,
    ).all<SavedPromptRow>();
    return c.json({ items: results ?? [] });
  });

  app.delete("/api/prompts/saved/:id", async (c) => {
    const result = await c.env.DB.prepare(
      `DELETE FROM saved_prompts WHERE id = ?`,
    )
      .bind(Number(c.req.param("id")))
      .run();
    return c.json({ ok: true, deleted: result.meta?.changes ?? 0 });
  });

  return app;
}
