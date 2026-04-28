import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveIdentity } from "../identityRepository";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TOKEN_FOR_ORG_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

describe("resolveIdentity cross-org boundary", () => {
  it("rejects a valid token when queried with a different org id", async () => {
    // DB returns no row because the (token, org_id) pair doesn't match
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: null,
          error: { message: "no rows returned" },
        }) as any,
    );

    await expect(resolveIdentity(TOKEN_FOR_ORG_A, ORG_B)).rejects.toThrow(
      "Identity resolution failed",
    );
  });

  it("returns a clean error for a malformed token without leaking PHI", async () => {
    const MALFORMED = "not-a-uuid";

    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: null,
          error: { message: "invalid input syntax for type uuid" },
        }) as any,
    );

    let thrownError: Error | undefined;
    try {
      await resolveIdentity(MALFORMED, ORG_A);
    } catch (e) {
      thrownError = e as Error;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError!.message).toMatch("Identity resolution failed");
    // The error message must not echo back any identity data
    expect(thrownError!.message).not.toMatch(/full_name|dob|contact_info/i);
  });

  it("returns a clean error for an expired token (no row returned)", async () => {
    // Expired tokens are pruned or flagged at the DB level; vault returns no row
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: null,
          error: { message: "expired token" },
        }) as any,
    );

    await expect(resolveIdentity(TOKEN_FOR_ORG_A, ORG_A)).rejects.toThrow(
      "Identity resolution failed",
    );
  });
});
