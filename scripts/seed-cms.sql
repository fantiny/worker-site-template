-- 作品池调整 + 关于页 + 首发博客(2026-09-30)
-- 幂等:作品按 id 固定写入,重复执行覆盖同 id

-- 1. 移除 cfKanban
DELETE FROM portfolio_items WHERE title = 'cfKanban';

-- 2. AICut 项目群(带详情)
INSERT OR REPLACE INTO portfolio_items (id, title, description, tech_stack, cover_url, links_json, sort_order, visible, detail_md) VALUES
  (10, '酥坡坡运营自动化系统',
   '宠物鲜食品牌「酥坡坡 SUPERPAW」的全域新媒体运营自动化:9 个松耦合系统 + 契约真源,覆盖内容生产、发布、CRM、数据回流全链路,已真实运行。',
   '["Python","CLI","FFmpeg","LLM","SQLite","契约化架构"]',
   '', '[]', 0, 1,
   '宠物鲜食品牌「酥坡坡 SUPERPAW」的全域新媒体运营自动化系统——从运营方案抽象、软件需求、开发计划到系统交付,全链路已交付并真实运行。

## 系统地图(五层单向依赖)

- **L4 数据回流**:OpsDashboard 只读聚合,静态 KPI 看板
- **L3 业务运营**:PublishManager / SubscribeCRM / GeoMonitor / PartnerPortal
- **L2 中台编排**:ContentHub(内容状态机、15 平台内容改编、排期)
- **L1 能力系统**:视频打标、AI 成片、合规引擎
- **L0 契约枢纽**:共享素材仓 + C0–C5 契约真源

## 工程亮点

- **契约化集成**:跨系统只走「CLI 子进程 + 带 schema_version 的 JSON 契约文件」,禁止 import 兄弟系统代码,松耦合可独立演进
- **内容状态机**:口播稿 → 合规过检 → 按稿成片 → 审核签字 → 发布队列,全程留痕可审计
- **一键工程化**:安装 / 环境自检 / 启动 / 全量回归(188 项测试)全部脚本化

## 我的角色

独立完成从运营方案抽象、系统拆分、契约设计到编码交付的全过程。'),
  (11, 'AI 短片成片引擎 FeedVideoMake',
   '输入一句主题,自动产出可发布短视频:LLM 决策分镜、语义绑定镜头、TTS 语音、FFmpeg 帧级合成与自动质检。',
   '["Python","LLM","FFmpeg","TTS","dHash 去重"]',
   '', '[]', 1, 1,
   '宠物鲜食短视频的自动成片引擎:输入一句主题,输出一条可发布的成片。链路:创作模式决策 → 分镜文案 → 素材语义检索绑定 → TTS 合成 → FFmpeg 合成 → 质检。

## 核心能力

- **AI 决策链**:创作模式、音画同步策略、分镜文案、镜头语义绑定全部由 LLM 决策,规则兜底,全程可审计(prompts / stages / trace.jsonl)
- **语音一致性**:全片单一音色、统一响度,语音永不句中截断(画面吸收时长差),QA 自动检查
- **语义匹配 + 视觉去重**:文案与镜头由 LLM 配对;关键帧 dHash 拦截视觉重复组
- **字幕冲突策略**:素材自带花字时自动检测,裁切 / 移位 / 规避

## 我的角色

架构设计与全部模块实现:common / mode / director / retrieve / script / tts / compose / qa / orch 九个包。'),
  (12, '视频拆解打标引擎 pet_cut_tag',
   '短视频镜头拆解 + 多层打标引擎与 Electron 审核台:景别/运镜/行为/情绪多维标签,支撑下游 AI 成片的素材检索。',
   '["Python","FFmpeg","PyTorch","Electron"]',
   '', '[]', 2, 1,
   '宠物短视频的「镜头拆解 + 多层打标」引擎与桌面审核台。

## 功能

- 镜头切分与关键帧提取,按批次自动分析
- 多层标签体系:景别 / 运镜 / 行为 / 情绪 / 适用类型等
- Electron 审核台:批次管理、按标签搜索、镜头时间线与多层标签编辑
- CLI 门面(tag_cut_cli.py),作为 L1 能力系统被内容中台调用

## 我的角色

独立设计打标体系与实现,含模型推理管线与桌面端。'),
  (13, '共享素材仓 FeedVideoAssets',
   '打标与成片引擎之间的共享资产仓:镜头索引(C0 契约)+ BGM 音乐库,是 AI 成片管线的 L0 数据底座。',
   '["契约设计","FFmpeg","loudnorm"]',
   '', '[]', 3, 1,
   '打标引擎与成片引擎之间的共享文件系统资产仓(L0)。

- **镜头索引(C0 契约)**:打标产物标准化入库,供成片侧按 SOP 槽位语义检索
- **BGM 音乐库**:音乐文件 + 标签索引,成片管线按分镜情绪提示过滤选曲;`-stream_loop` 循环铺满、单遍 loudnorm 到 -26 LUFS 垫底、首尾淡入淡出,与音频策略联动

定义了打标与成片两个能力仓之间的资产契约。'),
  (2, 'weWatchDog',
   'macOS 端企业微信/微信智能助理:屏幕感知新消息 → BM25 知识库检索 → LLM 生成回复并自动发送,含会话记忆、防自喂与多级兜底。',
   '["Python","FastAPI","BM25","LLM"]',
   '', '[]', 4, 1,
   'macOS 端企业微信 / 微信的智能助理系统,在真实生产环境长期运行。

## 工作链路

屏幕自动化感知新消息 → 中台(FastAPI)知识库 BM25 检索 → LLM 组装回复 → 自动发送。

## 关键设计(本站 AI 客服的同源血统)

- 零依赖 BM25 检索器:ASCII 词级 + CJK 单字分词,中文检索不依赖外部服务
- 防提示词投毒:知识库片段只放 user 侧,包「不可信检索片段」包装
- 防自喂循环:REPLY_PURPOSE 铁律,禁止延续自己的历史回复
- 多级兜底:LLM 失败 → 模板 / 抽取式回复;会话记忆 SQLite 落库

## 我的角色

独立设计与实现,含 macOS UI 自动化、中台服务、知识库与运营工具。'),
  (3, 'AI Customer Service 客服系统',
   '基于意图路由 + 混合 RAG(BM25 + 向量 RRF 融合)的客服系统,支持人工接管工作台、快捷提问与满意度评分。',
   '["Python","LangGraph","RAG","React"]',
   '', '[{"label":"GitHub","url":"https://github.com/fantiny/ai-customer-service"}]', 5, 1,
   '一套完整的智能客服参考实现:七意图路由(商品 / FAQ / 订单 / 售后 / 通用 / 转人工)、混合 RAG(BM25 + 向量,RRF 重排)、高风险操作人工审批(HITL)、实时客服工作台与客户对话组件。

## 特性

- 混合检索:BM25 词面 + pgvector 语义,RRF 融合排序
- 人工接管:LangGraph interrupt 挂起,客服工作台批准恢复
- 多语言支持,默认语言 Admin API 热更新
- 全量持久化与会话 / 工单 / 状态事件

## 我的角色

独立设计并实现,整洁架构分层,可对接任意 OpenAI 兼容模型。');

-- 3. 关于页内容(隐私版)
-- 完整的分级简历内容请执行:scripts/update-about-privacy.sql
INSERT INTO site_settings (key, value) VALUES ('about_md', '我是 **Jay**,一名深耕软件行业 **20 年**的工程师,其中 **10 年**在做项目管理。详细经历见 scripts/update-about-privacy.sql。')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

-- 4. 首发博客
INSERT INTO posts (slug, title, summary, content_md, tags, published, published_at) VALUES
  ('build-ai-hub-on-cloudflare-workers',
   '用 Cloudflare Workers 搭一个人的 AI 站',
   '知识库、提示词工具、每日 AI 日报、AI 客服、博客——一个人、一个 Worker、零服务器运维是怎么做到的。',
   '这个站是我给自己的一个小实验:**一个人的 AI 工具站,能不能不买服务器、不运维,还全都由 AI 驱动?**

答案是:一个 Cloudflare Worker 全栈,就够了。

## 架构

```
React SPA(4 套主题换肤)
  └─ Hono API
       ├─ D1(SQLite):笔记 / 客服知识库 / 日报 / 作品 / 文章
       ├─ Workers AI:GLM 生成 + bge-m3 向量化
       ├─ Vectorize:语义检索(笔记 + 客服知识库)
       ├─ KV:限流
       └─ Cron Triggers:每天早上 8 点抓 AI 资讯生成日报
```

## 几个有意思的点

**混合检索**。AI 客服的知识库检索是「词面 + 语义」双路:词面用 D1 的 FTS5,但 unicode61 分词器不切中文,所以我在**写入时就把文本预分词**(单字 + 二元组,借鉴 Lucene CJKAnalyzer),查询侧只发二元组避免单字歧义;语义路用 bge-m3 向量,两路结果 RRF 融合。实测「我家猫不爱喝水」能准确召回水碗清洁的文章。

**免费版的 CPU 限制**。第一版把 BM25 索引建在 Worker 内存里,7600 个分块直接撞上 10ms CPU 上限,请求被杀。教训:Worker 里只做 IO 编排,重活要么交给数据库(FTS5 的 bm25() 原生排序),要么在写入时预计算。

**推理模型的 token 预算**。GLM 系列是推理模型,思考过程也计入 max_tokens——不调大就「生成了但内容为空」,排查了半天才反应过来。

**零依赖中文检索**。从 weWatchDog 移植的教训都在:知识库片段只放 user 侧并包上「不可信」包装防投毒、防自喂铁律防复读、三级兜底(无命中就说不知道,绝不编造)。

## 成本

免费额度:10k Neurons/天 + D1/KV/Vectorize 免费档。目前每天一份日报加若干对话,绰绰有余。

接下来想把作品页充实起来,把 AICut 那套宠物视频自动化流水线也写几篇拆解。', '["Cloudflare","AI","全栈"]', 1, datetime('now'));

-- 5. 关于页联系人(页脚展示用)
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('contact_info', 'GitHub: @fantiny');
