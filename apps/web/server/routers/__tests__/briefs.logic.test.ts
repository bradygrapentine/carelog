// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

import { appRouter } from "@/server/trpc/router";
import type { Context } from "@/server/trpc";

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const USER_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const RECIPIENT_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const BRIEF_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

type Chain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function makeChain(result: { data: unknown; error: unknown }): Chain {
  const chain = {} as Chain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeCaller(chain: Chain) {
  const ctxSupabase = {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as Context["supabase"];
  const caller = appRouter.createCaller({
    user: { id: USER_ID, email: "user@example.com" } as Context["user"],
    supabase: ctxSupabase,
    req: undefined,
  } as Context);
  return { caller, ctxSupabase };
}

describe("briefs.latestForRecipient — logic", () => {
  it("returns the most-recent non-revoked brief for the (recipient, org) pair", async () => {
    const brief = {
      id: BRIEF_ID,
      title: "Today's brief",
      content: "Mom slept poorly. Three med doses missed.",
      includes: ["mood", "meds"],
      created_at: "2026-04-29T07:02:00Z",
    };
    const chain = makeChain({ data: brief, error: null });
    const { caller, ctxSupabase } = makeCaller(chain);

    const result = await caller.briefs.latestForRecipient({
      recipientId: RECIPIENT_ID,
      orgId: ORG_ID,
    });

    expect(result).toEqual(brief);
    expect(ctxSupabase.from).toHaveBeenCalledWith("care_briefs");
    expect(chain.eq).toHaveBeenCalledWith("recipient_id", RECIPIENT_ID);
    expect(chain.eq).toHaveBeenCalledWith("org_id", ORG_ID);
    expect(chain.eq).toHaveBeenCalledWith("revoked", false);
    expect(chain.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when no brief exists yet (caller renders empty state)", async () => {
    const chain = makeChain({ data: null, error: null });
    const { caller } = makeCaller(chain);

    const result = await caller.briefs.latestForRecipient({
      recipientId: RECIPIENT_ID,
      orgId: ORG_ID,
    });

    expect(result).toBeNull();
  });

  it("throws INTERNAL_SERVER_ERROR when Supabase returns an error", async () => {
    const chain = makeChain({
      data: null,
      error: { message: "connection lost" },
    });
    const { caller } = makeCaller(chain);

    await expect(
      caller.briefs.latestForRecipient({
        recipientId: RECIPIENT_ID,
        orgId: ORG_ID,
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "connection lost",
    });
  });

  it("rejects non-uuid input via Zod before hitting the database", async () => {
    const chain = makeChain({ data: null, error: null });
    const { caller, ctxSupabase } = makeCaller(chain);

    await expect(
      caller.briefs.latestForRecipient({
        recipientId: "not-a-uuid",
        orgId: ORG_ID,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(ctxSupabase.from).not.toHaveBeenCalled();
  });
});

describe("briefs.dashboardSummary — logic", () => {
  function makeMembershipChain(membership: { role: string } | null) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: membership, error: null }),
    };
    return chain;
  }

  function makeListChain(data: unknown[]) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data, error: null }),
      not: vi.fn().mockReturnThis(),
      then: undefined as unknown,
    };
    // Allow awaiting the chain itself (Promise-like) for queries that don't
    // end in .limit() — Supabase builders are thenable.
    chain.then = (resolve: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data, error: null }));
    return chain;
  }

  function buildCtxSupabase(overrides: Record<string, unknown>) {
    const ctxSupabase = {
      from: vi.fn((table: string) => {
        if (table in overrides) return overrides[table];
        return makeListChain([]);
      }),
    } as unknown as Context["supabase"];
    return ctxSupabase;
  }

  it("throws FORBIDDEN when caller is not a member of the org", async () => {
    const ctxSupabase = buildCtxSupabase({
      memberships: makeMembershipChain(null),
    });
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as Context["user"],
      supabase: ctxSupabase,
      req: undefined,
    } as Context);

    await expect(
      caller.briefs.dashboardSummary({
        recipientId: RECIPIENT_ID,
        orgId: ORG_ID,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects non-uuid input via Zod before any DB call", async () => {
    const ctxSupabase = buildCtxSupabase({
      memberships: makeMembershipChain({ role: "coordinator" }),
    });
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as Context["user"],
      supabase: ctxSupabase,
      req: undefined,
    } as Context);

    await expect(
      caller.briefs.dashboardSummary({
        recipientId: "nope",
        orgId: ORG_ID,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(ctxSupabase.from).not.toHaveBeenCalled();
  });
});
