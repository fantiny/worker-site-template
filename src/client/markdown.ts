import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ breaks: true, gfm: true });

/** 渲染 Markdown 为安全的 HTML(净化后输出,防模型输出/知识库投毒注入) */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false });
  return DOMPurify.sanitize(html);
}
