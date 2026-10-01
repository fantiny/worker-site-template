// Minimal structural types for Cloudflare bindings, kept in-repo so the
// worker never depends on @cloudflare/workers-types version drift.

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<unknown>;
}

export interface KVNamespace {
  get(key: string, type?: "text"): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface VectorizeVector {
  id: string;
  values: number[];
  namespace?: string;
  metadata?: Record<string, unknown>;
}

export interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorizeBinding {
  query(
    vector: number[],
    opts?: {
      topK?: number;
      namespace?: string;
      filter?: Record<string, unknown>;
      returnMetadata?: "none" | "indexed" | "all";
    },
  ): Promise<{ matches: VectorizeMatch[]; count?: number }>;
  upsert(vectors: VectorizeVector[]): Promise<{ mutationId?: string }>;
  insert(vectors: VectorizeVector[]): Promise<{ mutationId?: string }>;
  deleteByIds(ids: string[], namespace?: string): Promise<{ ids: string[] }>;
  getByIds(ids: string[], namespace?: string): Promise<VectorizeVector[]>;
  describe(): Promise<{ dims: number; metric: string; vectorType?: string; processedUpToUuid?: string }>;
}

export interface Fetcher {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
}

export interface WorkersAIBinding {
  run(model: string, input: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
}

export type Env = {
  DB: D1Database;
  // 本地 dev 配置(wrangler.dev.jsonc)不含 AI 绑定,代码须判空降级
  AI?: WorkersAIBinding;
  VEC: VectorizeBinding;
  KV: KVNamespace;
  ASSETS: Fetcher;
  // vars
  AI_PROVIDER?: string;
  AI_TEXT_MODEL?: string;
  EMBED_MODEL?: string;
  // secrets
  ADMIN_TOKEN?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
};
