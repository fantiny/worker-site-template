/**
 * 分块器:段落贪心切分,超长段落硬切并带重叠。
 * 参数与 weWatchDog kb.py 的 _chunk 一致(max_chars=600, overlap=100)。
 */
export function chunkText(
  text: string,
  maxChars = 600,
  overlap = 100,
): string[] {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let cur = "";

  const flush = () => {
    if (cur) {
      chunks.push(cur);
      cur = "";
    }
  };

  for (const p of paras) {
    if (p.length > maxChars) {
      flush();
      let start = 0;
      while (start < p.length) {
        chunks.push(p.slice(start, start + maxChars));
        if (start + maxChars >= p.length) break;
        start += maxChars - overlap;
      }
      continue;
    }
    if (cur.length === 0) {
      cur = p;
    } else if (cur.length + p.length + 2 <= maxChars) {
      cur += "\n\n" + p;
    } else {
      chunks.push(cur);
      cur = p;
    }
  }
  flush();
  return chunks;
}
