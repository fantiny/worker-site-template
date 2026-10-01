import { useEffect, useRef, useState } from "react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SESSION_KEY = "paih:chat:session";
const MSGS_KEY = "paih:chat:messages";

function newSessionId(): string {
  const hex = crypto.randomUUID().replace(/-/g, "");
  return `s${hex.slice(0, 24)}`;
}

function loadState(): { sessionId: string; messages: ChatMsg[] } {
  try {
    const sessionId = localStorage.getItem(SESSION_KEY) || newSessionId();
    const messages = JSON.parse(localStorage.getItem(MSGS_KEY) || "[]") as ChatMsg[];
    return { sessionId, messages: Array.isArray(messages) ? messages : [] };
  } catch {
    return { sessionId: newSessionId(), messages: [] };
  }
}

/** 解析 SSE 字节流为事件对象 */
async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      const line = evt.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        yield JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
      } catch {
        /* 忽略不完整事件 */
      }
    }
  }
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [quickQuestions, setQuickQuestions] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ sessionId: "", messages: [] as ChatMsg[] });

  // 初始化(读 localStorage,避免闭包旧值)
  useEffect(() => {
    const s = loadState();
    stateRef.current = s;
    setSessionId(s.sessionId);
    setMessages(s.messages);
  }, []);

  // 打开时拉取快捷提问
  useEffect(() => {
    if (!open || quickQuestions.length > 0) return;
    fetch("/api/chat/quick-questions")
      .then((r) => r.json())
      .then((d: { items: string[] }) => setQuickQuestions(d.items ?? []))
      .catch(() => {});
  }, [open, quickQuestions.length]);

  // 消息变化:持久化 + 滚动到底
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(MSGS_KEY, JSON.stringify(messages.slice(-60)));
      localStorage.setItem(SESSION_KEY, sessionId);
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sessionId]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming) return;
    const sid = stateRef.current.sessionId || newSessionId();
    stateRef.current.sessionId = sid;
    setSessionId(sid);

    const nextMsgs = [...stateRef.current.messages, { role: "user" as const, content: text }];
    stateRef.current.messages = nextMsgs;
    setMessages(nextMsgs);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, message: text }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `请求失败 (${res.status})`);
      }
      let assistantText = "";
      for await (const evt of parseSse(res.body)) {
        if (evt.type === "delta" && typeof evt.text === "string") {
          assistantText += evt.text;
          // 实时刷新流式中的助手消息
          const withStream = [
            ...stateRef.current.messages,
            { role: "assistant" as const, content: assistantText },
          ];
          setMessages(withStream);
        } else if (evt.type === "fallback" && typeof evt.text === "string") {
          assistantText = evt.text;
          setMessages([...stateRef.current.messages, { role: "assistant", content: assistantText }]);
        } else if (evt.type === "done") {
          break;
        }
      }
      if (!assistantText) {
        assistantText = "抱歉,我这边没有收到有效回复,请再试一次。";
      }
      stateRef.current.messages = [
        ...stateRef.current.messages,
        { role: "assistant", content: assistantText },
      ];
      setMessages(stateRef.current.messages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "网络异常,请稍后再试";
      stateRef.current.messages = [
        ...stateRef.current.messages,
        { role: "assistant", content: msg },
      ];
      setMessages(stateRef.current.messages);
    } finally {
      setStreaming(false);
    }
  };

  const reset = () => {
    const sid = newSessionId();
    stateRef.current = { sessionId: sid, messages: [] };
    setSessionId(sid);
    setMessages([]);
    try {
      localStorage.removeItem(MSGS_KEY);
      localStorage.setItem(SESSION_KEY, sid);
    } catch {}
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="panel-pop flex h-[28rem] w-88 max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <span className="text-sm font-semibold">AI 客服</span>
              <span className="ml-2 text-xs text-ink-muted">基于本站知识库回答</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={reset}
                className="text-xs text-ink-muted transition-colors hover:text-accent"
              >
                清空
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-ink-muted transition-colors hover:text-ink"
                aria-label="收起客服窗口"
              >
                ✕
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="pt-4 text-center text-sm text-ink-muted">
                你好!关于站点、作品或知识库内容,随时提问。
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`msg-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-card px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-brand text-onbrand"
                      : "border border-line bg-base text-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex justify-start">
                <div className="rounded-card border border-line bg-base px-3 py-2 text-sm text-ink-muted">
                  <span className="inline-block animate-pulse">● ● ●</span>
                </div>
              </div>
            )}
          </div>

          {messages.length === 0 && quickQuestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {quickQuestions.slice(0, 4).map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-card border border-line px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-brand hover:text-brand"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex items-center gap-2 border-t border-line px-3 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的问题…"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-card border border-line bg-base px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="pressable shrink-0 rounded-card bg-brand px-3.5 py-2 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              发送
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "收起 AI 客服" : "打开 AI 客服"}
        className="flex h-13 w-13 items-center justify-center rounded-full bg-brand text-2xl text-onbrand shadow-lg transition-transform hover:scale-105 hover:bg-brand-strong"
        style={{ height: "3.25rem", width: "3.25rem" }}
      >
        {open ? "✕" : "💬"}
      </button>
    </div>
  );
}
