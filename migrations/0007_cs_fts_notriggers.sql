-- 0007_cs_fts_notriggers: 移除 FTS 触发器,改为应用层维护。
-- 教训:外部内容表的 'delete' 命令要求条目已在索引中,
-- 触发器在索引不同步(改 schema / 批量操作后未 rebuild)时必然触发
-- SQLITE_CORRUPT_VTAB。改为:
--   - cs_chunks 是唯一真源;写入只发生在 cs_chunks
--   - 保存/删除文章后由应用执行 rebuild(全量重建,秒级)
--   - 查询侧始终 JOIN cs_chunks,孤立索引条目不影响正确性

DROP TRIGGER IF EXISTS cs_chunks_fts_insert;
DROP TRIGGER IF EXISTS cs_chunks_fts_delete;
DROP TRIGGER IF EXISTS cs_chunks_fts_update;
DROP TABLE IF EXISTS cs_chunks_fts;

CREATE VIRTUAL TABLE cs_chunks_fts USING fts5(
  title_tokens, tokens,
  content='cs_chunks', content_rowid='id',
  tokenize='unicode61'
);
