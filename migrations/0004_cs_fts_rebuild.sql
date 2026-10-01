-- 0004_cs_fts_rebuild: tokens 回填完成后重建 FTS 表、触发器并全量构建索引。
-- 应用写入 cs_chunks 时已带 tokens 列,触发器从此自动同步。

CREATE VIRTUAL TABLE cs_chunks_fts USING fts5(
  tokens,
  content='cs_chunks', content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER cs_chunks_fts_insert AFTER INSERT ON cs_chunks BEGIN
  INSERT INTO cs_chunks_fts(rowid, tokens) VALUES (new.id, new.tokens);
END;
CREATE TRIGGER cs_chunks_fts_delete AFTER DELETE ON cs_chunks BEGIN
  INSERT INTO cs_chunks_fts(cs_chunks_fts, rowid, tokens)
  VALUES ('delete', old.id, old.tokens);
END;
CREATE TRIGGER cs_chunks_fts_update AFTER UPDATE OF tokens ON cs_chunks BEGIN
  INSERT INTO cs_chunks_fts(cs_chunks_fts, rowid, tokens)
  VALUES ('delete', old.id, old.tokens);
  INSERT INTO cs_chunks_fts(rowid, tokens) VALUES (new.id, new.tokens);
END;

-- 从内容表全量构建 FTS 索引
INSERT INTO cs_chunks_fts(cs_chunks_fts) VALUES ('rebuild');
