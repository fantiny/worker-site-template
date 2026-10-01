import { useEffect, useState } from "react";
import { fetchAbout } from "@/api";
import { renderMarkdown } from "@/markdown";

export function About() {
  const [aboutMd, setAboutMd] = useState<string | null>(null);

  useEffect(() => {
    fetchAbout()
      .then((md) => setAboutMd(md || "关于页内容待补充。"))
      .catch(() => setAboutMd("关于页内容待补充。"));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">关于我</h1>
      {aboutMd === null ? (
        <div className="mt-8 h-64 animate-pulse rounded-card bg-raised" />
      ) : (
        <div
          className="about-prose mt-6"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(aboutMd) }}
        />
      )}
    </div>
  );
}
