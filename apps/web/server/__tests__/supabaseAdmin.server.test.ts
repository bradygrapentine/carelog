import { describe, it, expect } from "vitest";
import { wrapAdminError } from "../supabaseAdmin.server";

describe("wrapAdminError", () => {
  it("wraps PostgrestError with code 42501 with the env-hint", () => {
    const wrapped = wrapAdminError({
      code: "42501",
      message: "permission denied for table foo",
    });
    expect(wrapped.message).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(wrapped.message).toContain("permission denied for table foo");
  });

  it("wraps errors whose message mentions row-level security with the env-hint", () => {
    const wrapped = wrapAdminError({
      message: "new row violates row-level security policy",
    });
    expect(wrapped.message).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("passes through non-RLS PostgrestError messages without the env-hint", () => {
    const wrapped = wrapAdminError({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });
    expect(wrapped.message).toBe(
      "duplicate key value violates unique constraint",
    );
    expect(wrapped.message).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("falls back to a sentinel when message is missing", () => {
    const wrapped = wrapAdminError({ code: "XXXXX" });
    expect(wrapped.message).toBe("Unknown supabaseAdmin error");
  });

  it("returns an Error instance (preserves stack for Sentry)", () => {
    const wrapped = wrapAdminError({ code: "42501", message: "x" });
    expect(wrapped).toBeInstanceOf(Error);
  });
});
