import type { Env } from "@shared/env";

/**
 * KV 计数限流:按时间窗口分桶计数。
 * KV 最终一致,极端并发下可能少量超限——对防滥用场景足够。
 * 返回 true = 放行,false = 超限。
 */
export async function rateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  if (!env.KV) return true;
  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const k = `rl:${key}:${bucket}`;
  const current = Number((await env.KV.get(k)) || "0");
  if (current >= limit) return false;
  await env.KV.put(k, String(current + 1), { expirationTtl: windowSec + 60 });
  return true;
}

export function clientIp(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header("CF-Connecting-IP") || "unknown";
}
