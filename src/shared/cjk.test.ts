import { describe, expect, it } from "vitest";
import { tokenizeText, tokenizeQuery } from "./cjk";

describe("tokenizeText(索引侧)", () => {
  it("ASCII 按词,中文单字 + 相邻二元组", () => {
    const out = tokenizeText("Cloudflare 猫咪呕吐");
    const tokens = out.split(" ");
    expect(tokens).toContain("cloudflare");
    expect(tokens).toContain("猫");
    expect(tokens).toContain("猫咪");
    expect(tokens).toContain("咪呕");
    expect(tokens).toContain("呕吐");
    expect(tokens).not.toContain("cloudflar猫");
  });

  it("大写归一化", () => {
    expect(tokenizeText("Workers AI")).toContain("workers");
  });
});

describe("tokenizeQuery(查询侧)", () => {
  it("多字中文段只发二元组(消单字歧义)", () => {
    expect(tokenizeQuery("量子纠缠")).toEqual(["量子", "子纠", "纠缠"]);
  });

  it("孤立单字与 ASCII 词保留", () => {
    const t = tokenizeQuery("猫 cat");
    expect(t).toContain("猫");
    expect(t).toContain("cat");
  });

  it("混合文本:ASCII 词 + 中文二元组", () => {
    const t = tokenizeQuery("D1 数据库存储");
    expect(t).toContain("d1");
    expect(t).toContain("数据");
    expect(t).toContain("据库");
    // "存储" 二元组
    expect(t).toContain("存储");
  });
});
