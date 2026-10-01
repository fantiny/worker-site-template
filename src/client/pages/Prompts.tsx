import { useEffect, useState } from "react";
import { useAuth } from "@/auth";
import {
  deleteSavedPrompt,
  fetchSavedPrompts,
  generatePrompt,
  savePrompt,
  type SavedPrompt,
} from "@/api";

const SCENARIOS = ["通用", "写作", "编程", "分析", "翻译", "学习"] as const;
const FORMATS = ["不限", "Markdown", "JSON", "表格"] as const;
const DEPTHS = ["简洁", "适中", "详尽"] as const;

export function Prompts() {
  const { authed } = useAuth();
  const [mode, setMode] = useState<"idea" | "optimize">("idea");
  const [idea, setIdea] = useState("");
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]>("通用");
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("不限");
  const [depth, setDepth] = useState<(typeof DEPTHS)[number]>("适中");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedList, setSavedList] = useState<SavedPrompt[]>([]);

  const loadSaved = () => {
    if (authed) fetchSavedPrompts().then(setSavedList).catch(() => setSavedList([]));
  };
  useEffect(loadSaved, [authed]);

  const generate = async () => {
    setBusy(true);
    setError("");
    setResult("");
    try {
      const data = await generatePrompt({
        idea,
        scenario,
        format,
        depth,
        optimize: mode === "optimize",
      });
      setResult(data.prompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">提示词生成工具</h1>
      <p className="mt-2 text-sm text-ink-muted">
        描述你想让 AI 做的事,生成一份结构清晰、可直接使用的提示词;也可以粘贴已有提示词来优化。
      </p>

      <div className="mt-6 rounded-card border border-line bg-surface shadow-card p-5">
        {/* 模式切换 */}
        <div className="flex gap-2">
          {(
            [
              ["idea", "从想法生成"],
              ["optimize", "优化已有提示词"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`rounded-card px-3 py-1.5 text-sm transition-colors ${
                mode === id
                  ? "bg-raised font-medium text-brand"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder={
            mode === "idea"
              ? "例:我想让 AI 帮我把每周的工作日志整理成周报,发给老板看…"
              : "粘贴你想优化的提示词…"
          }
          rows={5}
          className="mt-4 w-full resize-y rounded-card border border-line bg-base px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-brand"
        />

        {/* 选项 */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <ChipRow label="场景" options={SCENARIOS} value={scenario} onChange={setScenario} />
          <ChipRow label="格式" options={FORMATS} value={format} onChange={setFormat} />
          <ChipRow label="详细" options={DEPTHS} value={depth} onChange={setDepth} />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={generate}
            disabled={busy || idea.trim().length < 2}
            className="rounded-card bg-brand px-6 py-2.5 text-sm font-medium text-onbrand transition-colors hover:bg-brand-strong disabled:opacity-50"
          >
            {busy ? "生成中,请稍候…" : "生成提示词"}
          </button>
          <span className="text-xs text-ink-muted">每小时 10 次,输入上限 4000 字</span>
        </div>
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </div>

      {/* 结果 */}
      {result && (
        <div className="mt-6 rounded-card border border-brand bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">生成的提示词</h2>
            <div className="flex gap-2 text-xs">
              <button
                onClick={copy}
                className="rounded-card border border-line px-3 py-1.5 transition-colors hover:border-brand hover:text-brand"
              >
                {copied ? "已复制 ✓" : "复制"}
              </button>
              {authed && (
                <button
                  onClick={async () => {
                    await savePrompt({ name: idea.slice(0, 30), content: result, meta: { scenario, format, depth } });
                    loadSaved();
                  }}
                  className="rounded-card border border-line px-3 py-1.5 transition-colors hover:border-brand hover:text-brand"
                >
                  保存
                </button>
              )}
            </div>
          </div>
          <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-card bg-base p-4 font-mono text-sm leading-relaxed">
            {result}
          </pre>
        </div>
      )}

      {/* 已保存(仅登录后) */}
      {authed && savedList.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">已保存的提示词</h2>
          <div className="mt-3 space-y-2">
            {savedList.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-card border border-line bg-surface shadow-card px-4 py-3 text-sm"
              >
                <span className="truncate font-medium">{p.name || "(未命名)"}</span>
                <span className="truncate text-xs text-ink-muted">{p.content}</span>
                <button
                  onClick={() => setIdea(p.content)}
                  className="ml-auto shrink-0 text-xs text-brand hover:underline"
                >
                  载入
                </button>
                <button
                  onClick={async () => {
                    await deleteSavedPrompt(p.id);
                    loadSaved();
                  }}
                  className="shrink-0 text-xs text-ink-muted hover:text-accent"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChipRow<T extends string>(props: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-muted">{props.label}</span>
      {props.options.map((opt) => (
        <button
          key={opt}
          onClick={() => props.onChange(opt)}
          className={`rounded-card px-2.5 py-1 text-xs transition-colors ${
            props.value === opt
              ? "bg-brand font-medium text-onbrand"
              : "border border-line text-ink-muted hover:border-brand hover:text-ink"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
