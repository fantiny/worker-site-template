-- 0003_cs_fts_drop: 回填 tokens 前先移除 FTS 表与触发器。
-- 0002 的 UPDATE 触发器在 FTS 索引为空时执行 'delete' 命令会导致
-- SQLITE_CORRUPT_VTAB(FTS5 要求 delete 的条目必须已存在于索引中)。
-- 正确顺序:0003 清除 → 回填 tokens → 0004 重建 FTS + 触发器 + rebuild。

DROP TRIGGER IF EXISTS cs_chunks_fts_insert;
DROP TRIGGER IF EXISTS cs_chunks_fts_delete;
DROP TRIGGER IF EXISTS cs_chunks_fts_update;
DROP TABLE IF EXISTS cs_chunks_fts;
