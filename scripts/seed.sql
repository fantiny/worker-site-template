-- 演示/初始数据(可重复执行前手工清理;仅用于初始化)
INSERT OR IGNORE INTO portfolio_items (id, title, description, tech_stack, cover_url, links_json, sort_order) VALUES
  (1, 'cfKanban',
   '部署在我自己 Cloudflare 账户上的看板协作工具,用于个人项目的开发管理。支持工作区 / 项目 / 卡片流转,数据存 D1。',
   '["Cloudflare Workers","D1","TypeScript"]',
   '',
   '[{"label":"在线访问","url":"https://cfkanban-worker.fantiny.workers.dev"},{"label":"GitHub","url":"https://github.com/jwq2011/cfkanban"}]',
   0),
  (2, 'weWatchDog',
   'macOS 端企业微信/微信智能助理:屏幕感知新消息 → BM25 知识库检索 → LLM 生成回复并自动发送,含会话记忆、防自喂与多级兜底。',
   '["Python","FastAPI","BM25","LLM"]',
   '',
   '[]',
   1),
  (3, 'AI Customer Service',
   '基于意图路由 + 混合 RAG(BM25 + 向量 RRF 融合)的客服系统,支持人工接管工作台、快捷提问与满意度评分。',
   '["Python","LangGraph","RAG","React"]',
   '',
   '[{"label":"GitHub","url":"https://github.com/fantiny/ai-customer-service"}]',
   2);

INSERT OR IGNORE INTO feed_sources (name, url, enabled) VALUES
  ('机器之心', 'https://www.jiqizhixin.com/rss', 1),
  ('TechCrunch AI', 'https://techcrunch.com/category/artificial-intelligence/feed/', 1),
  ('The Verge AI', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 1),
  ('Hacker News', 'https://hnrss.org/frontpage', 1);

INSERT OR IGNORE INTO quick_questions (text, sort_order, enabled) VALUES
  ('这个站是做什么的?', 0, 1),
  ('介绍一下你的作品', 1, 1),
  ('每天的新闻日报是怎么生成的?', 2, 1),
  ('怎么联系你?', 3, 1);

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('contact_info', '可在 GitHub(@fantiny)上找到我。'),
  ('intro_md', '喜欢折腾 AI 与自动化的独立开发者。');
