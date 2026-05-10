import { describe, it, expect } from "vitest";
import { checkServiceRoleKey } from "../validateServiceRoleKey";

// Helper — build a minimal JWT (header.payload.signature) with the given role.
function buildJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-signature-not-verified`;
}

describe("checkServiceRoleKey", () => {
  it("accepts a JWT whose role claim is service_role", () => {
    const key = buildJwt({ role: "service_role", iss: "supabase-demo" });
    expect(checkServiceRoleKey(key)).toEqual({ ok: true });
  });

  it("rejects a JWT whose role claim is anon", () => {
    const key = buildJwt({ role: "anon" });
    const result = checkServiceRoleKey(key);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/role claim is "anon"/);
    }
  });

  it("rejects a Supabase production-style sb_secret_* key (not a JWT)", () => {
    const result = checkServiceRoleKey("sb_secret_abc123def456");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/not a JWT/);
      expect(result.reason).toMatch(/sb_secret_/);
    }
  });

  it("rejects when env var is unset", () => {
    expect(checkServiceRoleKey(undefined)).toEqual({
      ok: false,
      reason: "SUPABASE_SERVICE_ROLE_KEY env var is unset",
    });
  });

  it("rejects an empty string", () => {
    expect(checkServiceRoleKey("")).toEqual({
      ok: false,
      reason: "SUPABASE_SERVICE_ROLE_KEY env var is unset",
    });
  });

  it("rejects a JWT missing the role claim", () => {
    const key = buildJwt({ iss: "x" });
    const result = checkServiceRoleKey(key);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/role claim is "undefined"/);
    }
  });
});
