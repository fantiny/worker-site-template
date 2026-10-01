#!/usr/bin/env node
// 宠物知识库导入脚本:把 /Users/jay/Downloads/articles 的 580 篇 Markdown
// 通过管理 API 逐篇导入线上 AI 客服知识库(每篇触发分块 + embedding + 向量同步)。
// 可重复执行:按标题跳过已导入文章,支持断点续传。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const SRC_DIR = "/Users/jay/Downloads/articles";
const BASE = process.env.BASE_URL || "https://personal-ai-hub.fantiny.workers.dev";
const TOKEN =
  process.env.ADMIN_TOKEN ||
  readFileSync(new URL("../.admin-token-prod.txt", import.meta.url), "utf8").trim();
const CONCURRENCY = 5;
const RETRIES = 3;

function* walkMd(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walkMd(p);
    else if (name.endsWith(".md")) yield p;
  }
}

function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    meta[key] = val;
  }
  return { meta, body: m[2] };
}

async function apiPost(path, body, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
}

async function main() {
  // 登录拿会话 cookie
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: TOKEN }),
  });
  if (!loginRes.ok) throw new Error(`登录失败: ${loginRes.status}`);
  const setCookie = loginRes.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");

  // 已有文章标题集合(断点续传)
  const existing = new Set();
  const listRes = await fetch(`${BASE}/api/admin/cs/articles`, { headers: { Cookie: cookie } });
  if (listRes.ok) {
    const data = await listRes.json();
    for (const a of data.items) existing.add(a.title);
    console.log(`线上已有 ${existing.size} 篇文章,将跳过同名`);
  }

  const files = [...walkMd(SRC_DIR)];
  console.log(`本地共 ${files.length} 篇 Markdown`);

  const tasks = [];
  let skipped = 0;
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const { meta, body } = parseFrontMatter(raw);
    const title = (meta.title || basename(file, ".md")).trim();
    if (existing.has(title)) {
      skipped++;
      continue;
    }
    tasks.push({ file, title, content: body.trim() });
  }
  console.log(`待导入 ${tasks.length} 篇(跳过 ${skipped} 篇已存在)`);

  let done = 0;
  let failed = 0;
  const failures = [];
  let cursor = 0;

  async function worker(id) {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      let ok = false;
      for (let attempt = 1; attempt <= RETRIES && !ok; attempt++) {
        try {
          await apiPost(
            "/api/admin/cs/articles",
            { title: task.title, content_md: task.content, enabled: true },
            cookie,
          );
          ok = true;
        } catch (e) {
          if (attempt === RETRIES) {
            failed++;
            failures.push(`${task.title} ← ${e.message}`);
          } else {
            await new Promise((r) => setTimeout(r, attempt * 3000));
          }
        }
      }
      done++;
      if (done % 25 === 0) {
        console.log(`进度 ${done}/${tasks.length}(失败 ${failed})`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

  console.log(`\n=== 导入完成 ===`);
  console.log(`成功 ${done - failed} / 失败 ${failed} / 跳过已存在 ${skipped}`);
  if (failures.length > 0) {
    console.log(`失败清单(重跑本脚本可续传补齐):`);
    for (const f of failures.slice(0, 20)) console.log("  ✗", f);
  }
}

main().catch((e) => {
  console.error("导入中断:", e);
  process.exit(1);
});
