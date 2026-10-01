-- 0001_init: 全量建表(知识库 / 客服KB / 会话 / 日报 / 作品 / 提示词)

-- ============ 个人知识库(仅站主可见) ============
CREATE TABLE knowledge_notes (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  content_md TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FTS5 全文检索(unicode61 分词:ASCII 按词,中文靠语义检索补足;
-- 中文关键词场景在应用层用 LIKE 兜底)
CREATE VIRTUAL TABLE knowledge_fts USING fts5(
  title, content_md, tags,
  content='knowledge_notes', content_rowid='id',
  tokenize='unicode61'
);
CREATE TRIGGER knowledge_fts_insert AFTER INSERT ON knowledge_notes BEGIN
  INSERT INTO knowledge_fts(rowid, title, content_md, tags)
  VALUES (new.id, new.title, new.content_md, new.tags);
END;
CREATE TRIGGER knowledge_fts_delete AFTER DELETE ON knowledge_notes BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content_md, tags)
  VALUES ('delete', old.id, old.title, old.content_md, old.tags);
END;
CREATE TRIGGER knowledge_fts_update AFTER UPDATE ON knowledge_notes BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content_md, tags)
  VALUES ('delete', old.id, old.title, old.content_md, old.tags);
  INSERT INTO knowledge_fts(rowid, title, content_md, tags)
  VALUES (new.id, new.title, new.content_md, new.tags);
END;

-- ============ AI 客服知识库 ============
CREATE TABLE cs_articles (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  content_md TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cs_chunks (
  id INTEGER PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES cs_articles(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  chunk_text TEXT NOT NULL
);
CREATE INDEX idx_cs_chunks_article ON cs_chunks(article_id);

-- kb_version:内容变更时自增,isolate 内 BM25 索引据此失效重建
CREATE TABLE cs_kb_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO cs_kb_meta (key, value) VALUES ('kb_version', '0');

-- ============ 客服会话记录 ============
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

-- ============ 每日 AI 日报 ============
CREATE TABLE feed_sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE news_items (
  id INTEGER PRIMARY KEY,
  digest_date TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  original_summary TEXT NOT NULL DEFAULT '',
  ai_summary TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_news_url_hash ON news_items(digest_date, url_hash);

CREATE TABLE daily_digests (
  id INTEGER PRIMARY KEY,
  digest_date TEXT NOT NULL UNIQUE,
  summary_md TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ 作品展示 ============
CREATE TABLE portfolio_items (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tech_stack TEXT NOT NULL DEFAULT '[]',
  cover_url TEXT NOT NULL DEFAULT '',
  links_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ 提示词工具 ============
CREATE TABLE saved_prompts (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'generated' CHECK (kind IN ('generated', 'template')),
  name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 客服快捷提问 chips(后台可配)
CREATE TABLE quick_questions (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1
);

-- ============ 站点设置(个人介绍、联系方式等 KV) ============
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
