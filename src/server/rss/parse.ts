import { XMLParser } from "fast-xml-parser";

export interface FeedItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
}

export interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"];
    if (typeof obj["@_href"] === "string") return obj["@_href"];
  }
  return "";
}

/** 去 HTML 标签 + 压缩空白 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** 解析 RSS 2.0 与 Atom,返回标准化条目 */
export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const rss = doc.rss as { channel?: Record<string, unknown> } | undefined;
  const atom = doc.feed as Record<string, unknown> | undefined;

  if (rss?.channel) {
    const channel = rss.channel;
    const items = asArray(channel.item as Record<string, unknown>[]).map(
      (item) => ({
        title: stripHtml(textOf(item.title)),
        link: textOf(item.link),
        summary: stripHtml(
          textOf(item.description) || textOf(item["content:encoded"]),
        ).slice(0, 500),
        publishedAt: normalizeDate(textOf(item.pubDate) || textOf(item["dc:date"])),
      }),
    );
    return { title: stripHtml(textOf(channel.title)), items };
  }

  if (atom) {
    const entries = asArray(atom.entry as Record<string, unknown>[]);
    const items = entries.map((entry) => {
      // Atom 的 link 是 <link href="..."/>,可能有多条,取 rel=alternate 或第一条
      const links = asArray(entry.link as Record<string, unknown>[]);
      const alt = links.find((l) => l["@_rel"] === "alternate") ?? links[0];
      const link = (alt?.["@_href"] as string) || "";
      return {
        title: stripHtml(textOf(entry.title)),
        link,
        summary: stripHtml(textOf(entry.summary) || textOf(entry.content)).slice(0, 500),
        publishedAt: normalizeDate(
          textOf(entry.published) || textOf(entry.updated),
        ),
      };
    });
    return { title: stripHtml(textOf(atom.title)), items };
  }

  return { title: "", items: [] };
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
