-- 0005_cms: 作品详情字段 + 博客文章表(CMS)

-- 作品详细介绍(点击卡片进入详情页,Markdown)
ALTER TABLE portfolio_items ADD COLUMN detail_md TEXT NOT NULL DEFAULT '';

-- 博客文章
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content_md TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_posts_published ON posts(published, published_at DESC);
