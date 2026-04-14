import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";

// Default: 5 requests per 15-minute fixed window per IP per endpoint.
// Callers can override per-call via the `options` arg — auth/OTP endpoints
// use a looser limit because legitimate users retry after a mistyped code.
// In production, throws when Upstash env vars are missing so rate limits are
// never silently disabled. In dev/test, no-ops with a clear log line.
const DEFAULT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_MAX_REQUESTS = 5;

let redis: Redis | null = null;
let devWarned = false;

export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

function getRedis(): Redis | null {
  const hasCreds =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!hasCreds) {
    if (isProductionRuntime()) {
      // Fail closed: loudly reject at call time so the ops team notices.
      throw new Error(
        "rateLimit: UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN must be set in production",
      );
    }
    if (!devWarned) {
      devWarned = true;
      logger.warn(
        "[rateLimit] Upstash env vars missing — rate limiting disabled (dev/test only).",
      );
    }
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded.split(",");
    return entries[entries.length - 1].trim();
  }
  return "unknown";
}

type RateLimitOptions = {
  max?: number;
  windowSeconds?: number;
};

// Returns null when the request is allowed, or a 503/429 response when appropriate.
export async function rateLimit(
  request: NextRequest,
  endpoint: string,
  options: RateLimitOptions = {},
): Promise<NextResponse | null> {
  const max = options.max ?? DEFAULT_MAX_REQUESTS;
  const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  let client: Redis | null;
  try {
    client = getRedis();
  } catch (e) {
    // Production misconfig — fail closed with 503 so the failure is visible to
    // callers and log aggregators, rather than silently letting traffic through.
    logger.error("[rateLimit] fail-closed:", e);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
  if (!client) return null;

  const ip = getClientIp(request);
  const key = "rl:" + endpoint + ":" + ip;

  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, windowSeconds);
  }

  if (count > max) {
    const minutes = Math.max(1, Math.round(windowSeconds / 60));
    return NextResponse.json(
      {
        error:
          "Too many requests. Please try again in " + minutes + " minutes.",
      },
      { status: 429, headers: { "Retry-After": String(windowSeconds) } },
    );
  }

  return null;
}
