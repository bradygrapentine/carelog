import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCareTeamForRecipient } from "../membershipsRepository";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    auth: { admin: { getUserById: vi.fn() } },
  },
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(supabaseAdmin.auth.admin.getUserById).mockReset();
});

// TD-142: the `acceptInvite` state-machine tests were removed alongside the
// repository function they exercised. The atomic invite-acceptance contract
// is now owned end-to-end by the `accept_invite` SQL function — verified by
// pgTAP cases under `supabase/tests/` (race, expiry, email-mismatch, REVOKE
// from anon/authenticated) and by router-layer tests in
// `apps/web/server/routers/__tests__/membershipsRouter.security.test.ts`.

describe("getCareTeamForRecipient", () => {
  const ORG_ID = "44444444-4444-4444-4444-444444444444";
  const RECIPIENT_ID = "55555555-5555-5555-5555-555555555555";
  const M1 = "66666666-6666-6666-6666-666666666666";
  const M2 = "77777777-7777-7777-7777-777777777777";
  const U1 = "88888888-8888-8888-8888-888888888888";
  const U2 = "99999999-9999-9999-9999-999999999999";

  function makeListChain(result: { data: unknown; error: unknown }) {
    // TD-122: thenable mock (mirrors `makeUpdateChain` at line 34 and the
    // Supabase client's actual PromiseLike contract). Resolution is decoupled
    // from filter-call shape — adding a 3rd `.not()` filter (e.g. soft-delete)
    // no longer silently stalls the mock. All filters are vi.fn so call-site
    // tests can still assert filter contracts directly (e.g. toHaveBeenCalledWith).
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.or = vi.fn(() => chain);
    chain.not = vi.fn(() => chain);
    // TD-121: prod chain now terminates at .limit(50) for the rate-limit cap.
    chain.limit = vi.fn(() => chain);
    chain.then = (resolve: (v: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve);
    return chain;
  }

  // TD-120: getCareTeamForRecipient now takes a session-scoped supabase
  // client as its first arg (RLS-gated read). Wrap a `makeListChain` chain
  // in a minimal client whose .from() returns it.
  function makeMockSupabaseClient(chain: Record<string, unknown>) {
    return { from: vi.fn(() => chain) } as unknown as never;
  }

  it("returns members with names resolved from auth.users.user_metadata.display_name", async () => {
    const chain = makeListChain({
      data: [
        { id: M1, user_id: U1, role: "coordinator", recipient_id: null },
        {
          id: M2,
          user_id: U2,
          role: "caregiver",
          recipient_id: RECIPIENT_ID,
        },
      ],
      error: null,
    });
    const mockSupabase = makeMockSupabaseClient(chain);
    vi.mocked(supabaseAdmin.auth.admin.getUserById)
      .mockResolvedValueOnce({
        data: {
          user: { id: U1, user_metadata: { display_name: "Alice Adams" } },
        },
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: {
          user: { id: U2, user_metadata: { display_name: "Bob Brown" } },
        },
        error: null,
      } as never);

    const result = await getCareTeamForRecipient(
      mockSupabase,
      ORG_ID,
      RECIPIENT_ID,
    );
    expect(result).toEqual([
      { id: M1, name: "Alice Adams", role: "coordinator", initials: "AA" },
      { id: M2, name: "Bob Brown", role: "caregiver", initials: "BB" },
    ]);

    // TD-140: lock the prod query shape. .select column-list intentionally
    // matched with stringContaining so a future additive column doesn't break
    // this test. .not() asserts deferred — called twice with different args.
    expect(chain.select).toHaveBeenCalledWith(
      expect.stringContaining("user_id"),
    );
    expect(chain.eq).toHaveBeenCalledWith("org_id", ORG_ID);
    expect(chain.or).toHaveBeenCalledWith(
      `recipient_id.eq.${RECIPIENT_ID},recipient_id.is.null`,
    );
    // TD-121: rate-limit cap applied post-filter.
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it("falls back to user_metadata.full_name when display_name absent", async () => {
    const mockSupabase = makeMockSupabaseClient(
      makeListChain({
        data: [{ id: M1, user_id: U1, role: "caregiver", recipient_id: null }],
        error: null,
      }),
    );
    vi.mocked(supabaseAdmin.auth.admin.getUserById).mockResolvedValueOnce({
      data: { user: { id: U1, user_metadata: { full_name: "Carl Carter" } } },
      error: null,
    } as never);

    const result = await getCareTeamForRecipient(
      mockSupabase,
      ORG_ID,
      RECIPIENT_ID,
    );
    expect(result[0]?.name).toBe("Carl Carter");
    expect(result[0]?.initials).toBe("CC");
  });

  it("falls back to 'Member' when user_metadata is empty", async () => {
    const mockSupabase = makeMockSupabaseClient(
      makeListChain({
        data: [{ id: M1, user_id: U1, role: "supporter", recipient_id: null }],
        error: null,
      }),
    );
    vi.mocked(supabaseAdmin.auth.admin.getUserById).mockResolvedValueOnce({
      data: { user: { id: U1, user_metadata: {} } },
      error: null,
    } as never);

    const result = await getCareTeamForRecipient(
      mockSupabase,
      ORG_ID,
      RECIPIENT_ID,
    );
    expect(result[0]?.name).toBe("Member");
    expect(result[0]?.initials).toBe("M");
  });

  it("returns empty array when no memberships match", async () => {
    const mockSupabase = makeMockSupabaseClient(
      makeListChain({ data: [], error: null }),
    );
    const result = await getCareTeamForRecipient(
      mockSupabase,
      ORG_ID,
      RECIPIENT_ID,
    );
    expect(result).toEqual([]);
    expect(supabaseAdmin.auth.admin.getUserById).not.toHaveBeenCalled();
  });

  it("throws when the memberships query errors", async () => {
    const mockSupabase = makeMockSupabaseClient(
      makeListChain({
        data: null,
        error: { message: "boom" },
      }),
    );
    await expect(
      getCareTeamForRecipient(mockSupabase, ORG_ID, RECIPIENT_ID),
    ).rejects.toThrow(/getCareTeamForRecipient failed: boom/);
  });

  it("returns surviving members when getUserById blips on one row", async () => {
    // TD-121: Promise.allSettled tolerates a rate-limit / network blip on
    // one member without 500ing the page; rejected settlement is logged.
    const mockSupabase = makeMockSupabaseClient(
      makeListChain({
        data: [
          { id: M1, user_id: U1, role: "coordinator", recipient_id: null },
          {
            id: M2,
            user_id: U2,
            role: "caregiver",
            recipient_id: RECIPIENT_ID,
          },
        ],
        error: null,
      }),
    );
    vi.mocked(supabaseAdmin.auth.admin.getUserById)
      .mockResolvedValueOnce({
        data: {
          user: { id: U1, user_metadata: { display_name: "Alice Adams" } },
        },
        error: null,
      } as never)
      .mockRejectedValueOnce(new Error("rate limit"));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getCareTeamForRecipient(
      mockSupabase,
      ORG_ID,
      RECIPIENT_ID,
    );

    expect(result).toEqual([
      { id: M1, name: "Alice Adams", role: "coordinator", initials: "AA" },
    ]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "getCareTeamForRecipient: getUserById rejected",
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});
