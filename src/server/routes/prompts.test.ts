import { describe, expect, it } from "vitest";
import { buildMetaPrompt, SCENARIOS } from "./prompts";

describe("buildMetaPrompt", () => {
  it("从想法生成:包含场景/格式/深度与原始想法", () => {
    const { system, user } = buildMetaPrompt({
      idea: "帮我写周报",
      scenario: "写作",
      format: "Markdown",
      depth: "详尽",
      optimize: false,
    });
    expect(system).toContain("写作");
    expect(system).toContain("Markdown");
    expect(system).toContain("详尽");
    expect(system).toContain("只输出最终提示词本身");
    expect(user).toContain("帮我写周报");
    expect(user).toContain("写出提示词");
  });

  it("优化模式:用户消息变为优化指令", () => {
    const { user } = buildMetaPrompt({
      idea: "你是个翻译",
      scenario: SCENARIOS[0],
      format: "不限",
      depth: "简洁",
      optimize: true,
    });
    expect(user).toContain("优化");
    expect(user).toContain("你是个翻译");
  });
});
