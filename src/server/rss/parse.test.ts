import { describe, expect, it } from "vitest";
import { parseFeed } from "./parse";

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>示例 RSS</title>
  <item>
    <title>AI 领域 &amp; 新进展</title>
    <link>https://example.com/1</link>
    <description><![CDATA[<p>今天发布了<b>新模型</b>,效果很好 &amp; 免费使用。</p>]]></description>
    <pubDate>Mon, 28 Sep 2026 08:00:00 GMT</pubDate>
  </item>
  <item>
    <title>第二条新闻</title>
    <link>https://example.com/2</link>
    <description>纯文本摘要</description>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom 示例</title>
  <entry>
    <title>Atom 条目一</title>
    <link rel="alternate" href="https://example.org/a"/>
    <summary>Atom 摘要内容</summary>
    <published>2026-09-28T10:00:00Z</published>
  </entry>
  <entry>
    <title>Atom 条目二</title>
    <link href="https://example.org/b"/>
    <content>另一个内容</content>
  </entry>
</feed>`;

describe("parseFeed", () => {
  it("解析 RSS 2.0,去 HTML 与实体转义", () => {
    const feed = parseFeed(RSS);
    expect(feed.title).toBe("示例 RSS");
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0].title).toBe("AI 领域 & 新进展");
    expect(feed.items[0].summary).toContain("新模型");
    expect(feed.items[0].summary).not.toContain("<");
    expect(feed.items[0].publishedAt).toBe("2026-09-28T08:00:00.000Z");
    expect(feed.items[1].link).toBe("https://example.com/2");
  });

  it("解析 Atom(含 link href 结构)", () => {
    const feed = parseFeed(ATOM);
    expect(feed.title).toBe("Atom 示例");
    expect(feed.items[0].link).toBe("https://example.org/a");
    expect(feed.items[0].summary).toBe("Atom 摘要内容");
    expect(feed.items[1].summary).toBe("另一个内容");
    expect(feed.items[1].publishedAt).toBeNull();
  });

  it("非法 XML 返回空", () => {
    expect(parseFeed("not xml at all").items).toHaveLength(0);
  });
});
