-- 0002_cs_fts: 客服知识库词面检索改为 D1 FTS5
-- tokens 列存预分词文本(标题+分块内容,单字+二元组,空格分隔),
-- 由应用写入时计算;FTS5 unicode61 对空格分词,bm25() 排序。

ALTER TABLE cs_chunks ADD COLUMN tokens TEXT NOT NULL DEFAULT '';

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
