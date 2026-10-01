import { describe, expect, it } from "vitest";
import { rrfFuse } from "../retrieval/rrf";

describe("rrfFuse", () => {
  it("融合两路排名,双路命中的条目排最前", () => {
    const fused = rrfFuse([
      ["a", "b", "c"],
      ["b", "d", "a"],
    ]);
    // b 在两路均为前 1、2 名,综合分高于 a(1、3 名)
    expect(fused[0].id).toBe("b");
    const order = fused.map((f) => f.id);
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("c"));
  });

  it("只在单路出现的条目按其排名参与融合", () => {
    const fused = rrfFuse([["x"], ["y"]]);
    // x 与 y 分别是两路的第 1 名,分数应相等
    expect(fused[0].score).toBeCloseTo(fused[1].score, 10);
  });

  it("k 越大,排名差距的影响越小", () => {
    const steep = rrfFuse([["a", "b", "c", "d", "e", "f"]], 60);
    const flat = rrfFuse([["a", "b", "c", "d", "e", "f"]], 6000);
    const gap = (list: ReturnType<typeof rrfFuse>) => list[0].score - list[5].score;
    expect(gap(flat)).toBeLessThan(gap(steep));
  });

  it("空输入返回空数组", () => {
    expect(rrfFuse([])).toEqual([]);
  });
});
