import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/server/repositories/membershipsRepository", () => ({
  getMemberships: vi.fn(),
  createMembershipAndInvite: vi.fn(),
}));
vi.mock("@/server/repositories/careEventsRepository", () => ({
  getTimeline: vi.fn(),
  insertEvent: vi.fn(),
  getFlaggedEvents: vi.fn(),
  insertEventIdempotent: vi.fn(),
}));
vi.mock("@/server/repositories/organizationsRepository", () => ({
  getOrganization: vi.fn(),
  createOrganization: vi.fn(),
  getUserOrganizations: vi.fn(),
}));
vi.mock("@/server/repositories/identityRepository", () => ({
  createIdentity: vi.fn(),
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { appRouter } from "@/server/trpc/router";

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

const anonCaller = appRouter.createCaller({
  user: null as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

/**
 * Builds a Supabase query chain that terminates with `.single()`.
 * Covers: .select().eq().not().limit().single()
 */
function makeSelectSingleChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    limit: () => chain,
  };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

/**
 * Builds a chain for count queries: .select().eq().not() → resolves directly.
 */
function makeCountChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
  };
  // count queries resolve the chain object itself
  Object.assign(chain, result);
  // make the chain thenable so await resolves to result
  chain.then = (resolve: (v: object) => void) => resolve(result);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

describe("billing.getSubscription", () => {
  it("returns subscription data for org with an active plan", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      callCount++;
      if (table === "memberships" && callCount === 1) {
        // membership lookup
        return makeSelectSingleChain({
          data: { org_id: ORG_ID },
          error: null,
        });
      }
      if (table === "organizations") {
        // org plan lookup
        return makeSelectSingleChain({
          data: { id: ORG_ID, plan: "family", stripe_id: "cus_test123" },
          error: null,
        });
      }
      if (table === "memberships" && callCount === 3) {
        // seat count
        return makeCountChain({ count: 4, error: null });
      }
      return makeSelectSingleChain({ data: null, error: null });
    });

    const result = await authedCaller.billing.getSubscription();

    expect(result).toMatchObject({
      planName: "family",
      status: "active",
      renewalDate: null,
      seatCount: 4,
    });
  });

  it("returns null when user has no membership row (no org)", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      makeSelectSingleChain({
        data: null,
        error: { code: "PGRST116", message: "no rows" },
      }),
    );

    const result = await authedCaller.billing.getSubscription();
    expect(result).toBeNull();
  });

  it("returns null when org is on free plan (no stripe_id)", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      callCount++;
      if (table === "memberships" && callCount === 1) {
        return makeSelectSingleChain({
          data: { org_id: ORG_ID },
          error: null,
        });
      }
      // org on free plan
      return makeSelectSingleChain({
        data: { id: ORG_ID, plan: "free", stripe_id: null },
        error: null,
      });
    });

    const result = await authedCaller.billing.getSubscription();
    expect(result).toBeNull();
  });

  it("throws UNAUTHORIZED when called by an unauthenticated caller", async () => {
    await expect(anonCaller.billing.getSubscription()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
