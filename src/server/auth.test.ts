import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  safeEqual,
} from "./auth";

// Node 环境补 atob/btoa(auth.ts 依赖,Workers 运行时自带)
if (typeof globalThis.atob !== "function") {
  globalThis.atob = (s: string) => Buffer.from(s, "base64").toString("binary");
}
if (typeof globalThis.btoa !== "function") {
  globalThis.btoa = (s: string) => Buffer.from(s, "binary").toString("base64");
}

describe("auth session token", () => {
  it("签发后可验证", async () => {
    const token = await createSessionToken("secret-123");
    expect(await verifySessionToken(token, "secret-123")).toBe(true);
  });

  it("错误密钥验证失败", async () => {
    const token = await createSessionToken("secret-123");
    expect(await verifySessionToken(token, "wrong")).toBe(false);
  });

  it("篡改 payload 验证失败", async () => {
    const token = await createSessionToken("secret-123");
    const [payload, sig] = token.split(".");
    // 将 payload 换成另一个合法 b64url(不同内容)
    const forged = btoa(
      JSON.stringify({ exp: Date.now() + 99999999 }),
    ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await verifySessionToken(`${forged}.${sig}`, "secret-123")).toBe(false);
    expect(forged).not.toBe(payload);
  });

  it("过期 token 验证失败", async () => {
    // 直接构造过期 payload + 正确签名
    const payload = btoa(JSON.stringify({ exp: Date.now() - 1000 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    // 用内部相同算法签名
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode("secret-123"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const sigB64 = Buffer.from(new Uint8Array(sig))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifySessionToken(`${payload}.${sigB64}`, "secret-123")).toBe(false);
  });
});

describe("safeEqual", () => {
  it("相同为 true,不同为 false", async () => {
    expect(await safeEqual("abc", "abc")).toBe(true);
    expect(await safeEqual("abc", "abd")).toBe(false);
    expect(await safeEqual("abc", "abcd")).toBe(false);
  });
});
