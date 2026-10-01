import type { Env } from "@shared/env";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  /** 非流式生成,返回去除 <think> 后的正文 */
  generate(messages: ChatMessage[], opts?: GenerateOptions): Promise<string>;
  /** 流式生成:返回逐段正文文本的 AsyncIterable */
  generateStream(
    messages: ChatMessage[],
    opts?: GenerateOptions,
  ): Promise<AsyncIterable<string>>;
  /** 批量 embedding */
  embed(texts: string[]): Promise<number[][]>;
}

export class AIDataUnavailableError extends Error {
  constructor() {
    super("AI binding is not available in this environment");
    this.name = "AIDataUnavailableError";
  }
}

/** 去除推理模型输出的 <think>...</think> 段(参考 weWatchDog strip_think) */
export function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim();
}

function openAIMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

class WorkersAIProvider implements AIProvider {
  constructor(
    private env: Env,
    private model: string,
    private embedModel: string,
  ) {}

  private toWorkersMessages(messages: ChatMessage[]) {
    // Workers AI 的 messages 接口不支持 system 独立字段时,统一走 messages 数组
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  async generate(messages: ChatMessage[], opts?: GenerateOptions): Promise<string> {
    if (!this.env.AI) throw new AIDataUnavailableError();
    const result = (await this.env.AI.run(this.model, {
      messages: this.toWorkersMessages(messages),
      // GLM 等推理模型的思考过程也计入 max_tokens,给足余量
      max_tokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.7,
    })) as {
      response?: string;
      choices?: { message?: { content?: string } }[];
    };
    const text =
      result?.response ?? result?.choices?.[0]?.message?.content ?? "";
    return stripThink(text);
  }

  async generateStream(
    messages: ChatMessage[],
    opts?: GenerateOptions,
  ): Promise<AsyncIterable<string>> {
    if (!this.env.AI) throw new AIDataUnavailableError();
    const stream = (await this.env.AI.run(this.model, {
      messages: this.toWorkersMessages(messages),
      max_tokens: opts?.maxTokens ?? 1024,
      temperature: opts?.temperature ?? 0.7,
      stream: true,
    })) as ReadableStream<Uint8Array>;

    let loggedFirst = false;
    return sseTextStream(stream, (payload) => {
      if (!loggedFirst) {
        loggedFirst = true;
        console.log("workers-ai first sse payload:", payload.slice(0, 300));
      }
      try {
        const json = JSON.parse(payload) as {
          response?: string;
          choices?: { delta?: { content?: string } }[];
        };
        // 兼容两种事件格式:workers-ai 传统 {response} 与 OpenAI 风格 {choices[].delta}
        return json.response ?? json.choices?.[0]?.delta?.content ?? "";
      } catch {
        return "";
      }
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.env.AI) throw new AIDataUnavailableError();
    const result = (await this.env.AI.run(this.embedModel, {
      text: texts,
    })) as { data?: number[][] };
    if (!result?.data) throw new Error("embedding failed: empty data");
    return result.data;
  }
}

class OpenAICompatProvider implements AIProvider {
  constructor(
    private env: Env,
    private model: string,
    private embedModel: string,
  ) {}

  private get baseUrl() {
    return (this.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.env.AI_API_KEY ?? ""}`,
    };
  }

  async generate(messages: ChatMessage[], opts?: GenerateOptions): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: openAIMessages(messages),
        max_tokens: opts?.maxTokens ?? 1024,
        temperature: opts?.temperature ?? 0.7,
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`LLM generate failed: ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return stripThink(json.choices?.[0]?.message?.content ?? "");
  }

  async generateStream(
    messages: ChatMessage[],
    opts?: GenerateOptions,
  ): Promise<AsyncIterable<string>> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: openAIMessages(messages),
        max_tokens: opts?.maxTokens ?? 1024,
        temperature: opts?.temperature ?? 0.7,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`LLM stream failed: ${res.status}`);
    return sseTextStream(res.body, (payload) => {
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        return json.choices?.[0]?.delta?.content ?? "";
      } catch {
        return "";
      }
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ model: this.embedModel, input: texts }),
    });
    if (!res.ok) throw new Error(`embeddings failed: ${res.status}`);
    const json = (await res.json()) as { data?: { embedding: number[] }[] };
    if (!json.data) throw new Error("embedding failed: empty data");
    return json.data.map((d) => d.embedding);
  }
}

/** 解析 SSE 字节流为逐事件文本,transformer 返回该事件对外吐出的文本 */
async function* sseTextStream(
  stream: ReadableStream<Uint8Array>,
  extract: (payload: string) => string,
): AsyncGenerator<string> {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split(/\n\n/);
    buffer = events.pop() ?? "";
    for (const evt of events) {
      for (const line of evt.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        const out = extract(payload);
        if (out) yield out;
      }
    }
  }
}

export function getProvider(env: Env): AIProvider {
  const textModel = env.AI_TEXT_MODEL || "@cf/zai-org/glm-4.7-flash";
  const embedModel = env.EMBED_MODEL || "@cf/baai/bge-m3";
  if (env.AI_PROVIDER === "openai" && env.AI_API_KEY) {
    return new OpenAICompatProvider(env, textModel, embedModel);
  }
  return new WorkersAIProvider(env, textModel, embedModel);
}
