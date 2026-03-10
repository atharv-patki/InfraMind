import type { Context } from "hono";

export type RateLimitBucket = "auth" | "mutation";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitPolicy = {
  auth: {
    windowMs: number;
    maxRequests: number;
  };
  mutation: {
    windowMs: number;
    maxRequests: number;
  };
  maxStoreSize: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

const DEFAULT_POLICY: RateLimitPolicy = {
  auth: {
    windowMs: 60_000,
    maxRequests: 20,
  },
  mutation: {
    windowMs: 60_000,
    maxRequests: 180,
  },
  maxStoreSize: 4_000,
};

function normalizeApiPath(path: string): string {
  if (path.startsWith("/api/v1/")) {
    return path.replace(/^\/api\/v1/, "/api");
  }
  return path;
}

export function resolveRateLimitBucket(method: string, path: string): RateLimitBucket | null {
  const normalizedPath = normalizeApiPath(path);

  if (method === "POST" && normalizedPath.startsWith("/api/auth/")) {
    return "auth";
  }

  if ((method === "POST" || method === "PUT" || method === "DELETE") && normalizedPath.startsWith("/api/")) {
    return "mutation";
  }

  return null;
}

export function getClientIdentifier(c: Context): string {
  const cfConnectingIp = c.req.header("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown-client";
}

export function applyRateLimit(
  bucket: RateLimitBucket,
  clientId: string,
  policy: RateLimitPolicy = DEFAULT_POLICY
): RateLimitResult {
  const now = Date.now();
  const bucketPolicy = bucket === "auth" ? policy.auth : policy.mutation;
  const key = `${bucket}:${clientId}`;

  const existing = rateLimitStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + bucketPolicy.windowMs,
    };
    rateLimitStore.set(key, entry);
    cleanupRateLimitStore(now, policy.maxStoreSize);

    return {
      allowed: true,
      limit: bucketPolicy.maxRequests,
      remaining: Math.max(0, bucketPolicy.maxRequests - entry.count),
      resetAt: entry.resetAt,
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  cleanupRateLimitStore(now, policy.maxStoreSize);

  const allowed = existing.count <= bucketPolicy.maxRequests;
  const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    allowed,
    limit: bucketPolicy.maxRequests,
    remaining: Math.max(0, bucketPolicy.maxRequests - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds,
  };
}

function cleanupRateLimitStore(now: number, maxStoreSize: number): void {
  if (rateLimitStore.size < maxStoreSize) return;

  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}
