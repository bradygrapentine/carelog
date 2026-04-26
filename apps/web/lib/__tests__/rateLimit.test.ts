import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getClientIp, rateLimit } from "../rateLimit";

function makeRequest(headers: Record<string, string>) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as any;
}

describe("getClientIp", () => {
  it("prefers x-real-ip over x-forwarded-for", () => {
    const req = makeRequest({
      "x-real-ip": "1.2.3.4",
      "x-forwarded-for": "9.9.9.9, 8.8.8.8",
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns the last x-forwarded-for entry when no x-real-ip", () => {
    // First entry is attacker-controlled; last is the trusted upstream proxy
    const req = makeRequest({ "x-forwarded-for": "9.9.9.9, 8.8.8.8, 1.2.3.4" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("handles a single x-forwarded-for entry", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns unknown when neither header is present", () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("rateLimit fail-closed behavior", () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("no-ops in dev when Upstash env vars are missing", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV =
      "development";
    delete process.env.VERCEL_ENV;
    const req = makeRequest({ "x-real-ip": "1.2.3.4" });
    const res = await rateLimit(req, "test/endpoint");
    expect(res).toBeNull();
  });

  // TD-44: NODE_ENV=production alone (CI E2E, local `pnpm start`, preview
  // builds) is NOT real prod — only VERCEL_ENV=production is. Don't fail
  // closed in those environments or we 503 every rate-limited route in CI.
  it("no-ops when NODE_ENV=production but VERCEL_ENV is unset (CI E2E / local prod-mode)", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.VERCEL_ENV;
    const req = makeRequest({ "x-real-ip": "1.2.3.4" });
    const res = await rateLimit(req, "test/endpoint");
    expect(res).toBeNull();
  });

  it("returns 503 when VERCEL_ENV=production and creds missing (real prod, fail-closed)", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV =
      "development";
    process.env.VERCEL_ENV = "production";
    const req = makeRequest({ "x-real-ip": "1.2.3.4" });
    const res = await rateLimit(req, "test/endpoint");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
  });
});
