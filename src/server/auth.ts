import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import type { Env } from "@shared/env";

const COOKIE_NAME = "paih_session";
const SESSION_TTL_SEC = 7 * 24 * 3600;

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(sig);
}

/** 签发无状态会话 cookie 值:base64url(payload).hmac */
export async function createSessionToken(secret: string): Promise<string> {
  const payload = b64urlEncode(
    encoder.encode(JSON.stringify({ exp: Date.now() + SESSION_TTL_SEC * 1000 })),
  );
  const sig = await hmac(secret, payload);
  return `${payload}.${b64urlEncode(sig)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(secret, payload);
  let actual: Uint8Array;
  try {
    actual = b64urlDecode(sig);
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  // 常数时间比较,避免逐字节短路
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  if (diff !== 0) return false;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as {
      exp?: number;
    };
    return typeof parsed.exp === "number" && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

/** 常数时间比较两个字符串(先哈希归一长度) */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const da = await crypto.subtle.digest("SHA-256", encoder.encode(a));
  const db = await crypto.subtle.digest("SHA-256", encoder.encode(b));
  const xa = new Uint8Array(da);
  const xb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ xb[i];
  return diff === 0;
}

export async function setSessionCookie(c: Context<{ Bindings: Env }>) {
  const token = await createSessionToken(c.env.ADMIN_TOKEN!);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export function clearSessionCookie(c: Context<{ Bindings: Env }>) {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

/** 管理端中间件:校验签名 cookie */
export async function requireAdmin(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<Response | void> {
  const secret = c.env.ADMIN_TOKEN;
  if (!secret) return c.json({ error: "ADMIN_TOKEN not configured" }, 503);
  const token = getCookie(c, COOKIE_NAME);
  if (!token || !(await verifySessionToken(token, secret))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
}

/** 供 /api/auth/me 等只读判断使用 */
export async function isAuthenticated(
  c: Context<{ Bindings: Env }>,
): Promise<boolean> {
  const secret = c.env.ADMIN_TOKEN;
  if (!secret) return false;
  const token = getCookie(c, COOKIE_NAME);
  return Boolean(token && (await verifySessionToken(token, secret)));
}
