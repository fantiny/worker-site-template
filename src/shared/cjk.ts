/**
 * CJK 分词器(前后端共享):
 * - 索引侧 tokenizeText:ASCII 词级 + CJK 单字 + 相邻二元组,空格连接后存入
 *   D1 FTS5(unicode61 对空格分词,预分词绕开其不切中文的问题)
 * - 查询侧 tokenizeQuery:多字中文段只发二元组(Lucene CJKAnalyzer 风格),
 *   避免单字歧义噪声(如"量子纠缠"的"量"误配"饮水量")
 * 原实现移植自 weWatchDog BM25Retriever,因免费版 Worker CPU 限制,
 * 词面检索改为 D1 FTS5 原生 bm25() 排序(写入时预分词)。
 */

const TOKEN_RE = /[a-z0-9]+|[\u3400-\u9fff]/g;
const ASCII_RE = /^[a-z0-9]+$/;

function splitPieces(text: string): { cjk: boolean; v: string }[] {
  const lower = text.toLowerCase();
  const pieces: { cjk: boolean; v: string }[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(lower)) !== null) {
    const v = m[0];
    pieces.push({ cjk: !ASCII_RE.test(v), v });
  }
  return pieces;
}

/** 索引侧:输出用空格连接的分词串(供 FTS5 索引列存储) */
export function tokenizeText(text: string): string {
  const pieces = splitPieces(text);
  const tokens: string[] = [];
  for (let i = 0; i < pieces.length; i++) {
    tokens.push(pieces[i].v);
    if (pieces[i].cjk && i + 1 < pieces.length && pieces[i + 1].cjk) {
      tokens.push(pieces[i].v + pieces[i + 1].v);
    }
  }
  return tokens.join(" ");
}

/** 查询侧:返回词元数组(多字中文段仅二元组,孤立单字与 ASCII 词保留) */
export function tokenizeQuery(text: string): string[] {
  const pieces = splitPieces(text);
  const tokens: string[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const prevSameRun = i > 0 && pieces[i - 1].cjk && p.cjk;
    const nextSameRun = p.cjk && i + 1 < pieces.length && pieces[i + 1].cjk;
    if (nextSameRun) {
      tokens.push(p.v + pieces[i + 1].v);
    } else if (!prevSameRun) {
      // 不在任何二元组中的孤立单字才保留
      tokens.push(p.v);
    }
  }
  return tokens;
}
