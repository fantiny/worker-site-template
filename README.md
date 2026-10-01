# personal-ai-hub

个人 AI 站点,单 Cloudflare Worker 全栈:React SPA + Hono API + D1 + Workers AI + Vectorize。

## 功能

| 路由 | 功能 | 权限 |
|---|---|---|
| `/` | 个人介绍 + 精选作品 + 最新日报 | 公开 |
| `/portfolio` | 作品展示(后台可管理) | 公开 |
| `/prompts` | 提示词生成工具(AI 生成/优化,限流 10 次/时/IP) | 公开 |
| `/daily` | 每日 AI 资讯日报(每天 08:00 北京时间自动生成) | 公开 |
| `/knowledge` | 个人知识库(FTS5 关键词 + Vectorize 语义混合搜索) | 仅站主 |
| `/admin` | 后台:作品 / 客服知识库 / RSS 源 / 会话记录 / 手动生成日报 | 仅站主 |
| 全站 | 右下角 AI 客服 chatbox(知识库混合检索 + SSE 流式) | 公开 |

- 4 套主题一键换肤(暗夜科技 / 极简纸白 / 终端绿 / 墨韵暖调),CSS 变量令牌 + `data-theme`,无闪烁
- AI 客服检索:词面(D1 FTS5,**写入时预分词**——单字+二元组,查询侧二元组,FTS5 原生 bm25() 排序)+ bge-m3 向量 + RRF 融合;三级兜底(无命中话术 / 抽取式 / 模板)。不在 Worker 内构建内存索引(免费版 10ms CPU 限制)
- 知识库语料:内置 580 篇猫咪养护文章(`scripts/import-pet-kb.mjs` 导入)+ 站点介绍;AI 可同时回答站点与养猫问题
- AI 提供方可切换:`AI_PROVIDER=workers-ai`(默认)或 `openai`(配 `AI_API_KEY` + `AI_BASE_URL`,OpenAI 兼容接口)

## 本地开发

```bash
npm install
npm run db:migrate:local   # 本地 D1 建表
npm run db:seed:local      # 示例数据(作品/RSS源/快捷提问)
npm run dev                # vite watch + wrangler dev(本地无 AI 绑定,AI 功能返回 503)
```

本地 dev 配置在 `wrangler.dev.jsonc`(无 AI 绑定,无需登录);`.dev.vars` 提供 `ADMIN_TOKEN=dev-admin-token`。

测试:`npm run test`(vitest);类型:`npm run typecheck`。

## 部署

```bash
npx wrangler login                      # 首次:浏览器 OAuth 授权
npx wrangler d1 create personal-ai-hub-db
npx wrangler kv namespace create KV
npx wrangler vectorize create personal-ai-hub-vec --dimensions=1024 --metric=cosine
# 把返回的 id 填入 wrangler.jsonc 的 database_id / kv id
npm run db:migrate:remote
npm run db:seed:remote
npx wrangler secret put ADMIN_TOKEN     # 管理登录密钥
npm run deploy                          # 构建并部署
```

部署后:打开 `/admin` 用 `ADMIN_TOKEN` 登录,在后台手动"立即生成今日日报"验证 AI 链路;向量索引首次为空,保存/重建客服知识库与笔记后会自动 embedding。

## 结构

```
src/client/       React SPA(pages/components/themes/api/auth/markdown)
src/server/       Hono API(routes/)+ AI provider + 检索(retrieval/)+ 客服(cs/)+ 日报(cron/)+ RSS(rss/)
src/shared/       前后端共享类型与绑定定义
migrations/       D1 schema(FTS5 + 触发器)
scripts/seed.sql  初始数据
```
