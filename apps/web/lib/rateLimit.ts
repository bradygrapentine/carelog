import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";

// 5 requests per 15-minute fixed window per IP per endpoint.
// No-ops (allows all requests) when UPSTASH env vars are absent — local dev only.
const WINDOW_SECONDS = 15 * 60;
const MAX_REQUESTS = 5;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
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

// Returns null when the request is allowed, or a 429 response when the limit is exceeded.
export async function rateLimit(
  request: NextRequest,
  endpoint: string,
): Promise<NextResponse | null> {
  const client = getRedis();
  if (!client) return null;

  const ip = getClientIp(request);
  const key = "rl:" + endpoint + ":" + ip;

  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, WINDOW_SECONDS);
  }

  if (count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in 15 minutes." },
      { status: 429, headers: { "Retry-After": String(WINDOW_SECONDS) } },
    );
  }

  return null;
}
