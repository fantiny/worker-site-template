-- 0006_cs_fts_title: 标题单独成列用于 bm25 加权(标题命中 8 倍权重),
-- tokens 列语义变更为"仅正文分词"。

ALTER TABLE cs_chunks ADD COLUMN title_tokens TEXT NOT NULL DEFAULT '';

DROP TRIGGER IF EXISTS cs_chunks_fts_insert;
DROP TRIGGER IF EXISTS cs_chunks_fts_delete;
DROP TRIGGER IF EXISTS cs_chunks_fts_update;
DROP TABLE IF EXISTS cs_chunks_fts;

CREATE VIRTUAL TABLE cs_chunks_fts USING fts5(
  title_tokens, tokens,
  content='cs_chunks', content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER cs_chunks_fts_insert AFTER INSERT ON cs_chunks BEGIN
  INSERT INTO cs_chunks_fts(rowid, title_tokens, tokens)
  VALUES (new.id, new.title_tokens, new.tokens);
END;
CREATE TRIGGER cs_chunks_fts_delete AFTER DELETE ON cs_chunks BEGIN
  INSERT INTO cs_chunks_fts(cs_chunks_fts, rowid, title_tokens, tokens)
  VALUES ('delete', old.id, old.title_tokens, old.tokens);
END;
CREATE TRIGGER cs_chunks_fts_update AFTER UPDATE ON cs_chunks BEGIN
  INSERT INTO cs_chunks_fts(cs_chunks_fts, rowid, title_tokens, tokens)
  VALUES ('delete', old.id, old.title_tokens, old.tokens);
  INSERT INTO cs_chunks_fts(rowid, title_tokens, tokens)
  VALUES (new.id, new.title_tokens, new.tokens);
END;
-- 注意:索引重建(rebuild)在 tokens/title_tokens 回填后单独执行
