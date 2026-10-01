import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("短段落合并为一块", () => {
    const chunks = chunkText("第一段。\n\n第二段。\n\n第三段。", 600, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("第一段。");
    expect(chunks[0]).toContain("第三段。");
  });

  it("超过 max_chars 时按段落边界分块", () => {
    const p = "A".repeat(400);
    const q = "B".repeat(400);
    const chunks = chunkText(`${p}\n\n${q}`, 600, 100);
    expect(chunks).toHaveLength(2);
  });

  it("单段超长硬切且带 overlap", () => {
    const text = "X".repeat(1500);
    const chunks = chunkText(text, 600, 100);
    expect(chunks.length).toBe(3);
    // 相邻块重叠 100 字符
    expect(chunks[1].startsWith(chunks[0].slice(500))).toBe(true);
  });

  it("空文本返回空数组", () => {
    expect(chunkText("", 600, 100)).toEqual([]);
  });
});
