#!/usr/bin/env node
// 为存量 cs_chunks 回填 tokens 预分词列(0002 迁移后的一次性操作):
// 1. wrangler d1 分页拉取全部分块 → 2. 本地计算分词 → 3. 分批 UPDATE 回填。
// 注意:须在 0003(移除 FTS 触发器)之后、0004(重建 FTS)之前运行。
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tokenizeText } from "../src/shared/cjk.ts";

function d1Json(sql) {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "personal-ai-hub-db", "--remote", "--json", "--command", sql],
    { maxBuffer: 512 * 1024 * 1024 },
  );
  const text = out.toString();
  // wrangler 在大结果集时会往 stdout 混入提示行,从第一个行首 "[" 开始截取
  const start = text.indexOf("\n[");
  const json = JSON.parse(start >= 0 ? text.slice(start + 1) : text);
  return json[0].results;
}

console.log("拉取分块(分页)...");
const PAGE = 500;
const rows = [];
for (let offset = 0; ; offset += PAGE) {
  const page = d1Json(`SELECT id, title, chunk_text FROM cs_chunks ORDER BY id LIMIT ${PAGE} OFFSET ${offset}`);
  rows.push(...page);
  console.log(`  已拉取 ${rows.length}`);
  if (page.length < PAGE) break;
}
console.log(`共 ${rows.length} 个分块`);

const BATCH = 400;
let updated = 0;
for (let start = 0; start < rows.length; start += BATCH) {
  const slice = rows.slice(start, start + BATCH);
  const stmts = slice.map(
    (r) =>
      `UPDATE cs_chunks SET tokens = '${tokenizeText(r.chunk_text).replace(/'/g, "''")}', title_tokens = '${tokenizeText(r.title).replace(/'/g, "''")}' WHERE id = ${r.id};`,
  );
  const file = `/tmp/cs-tokens-${start}.sql`;
  writeFileSync(file, stmts.join("\n"));
  execFileSync("npx", [
    "wrangler", "d1", "execute", "personal-ai-hub-db", "--remote", "--file=" + file, "-y",
  ], { stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });
  updated += slice.length;
  console.log(`已回填 ${updated}/${rows.length}`);
}

console.log("回填完成(FTS 重建由迁移 0004 负责)");
