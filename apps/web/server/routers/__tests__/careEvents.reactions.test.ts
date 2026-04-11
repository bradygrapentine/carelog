import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/server/repositories/careEventsRepository", () => ({
  getTimeline: vi.fn(),
  insertEvent: vi.fn().mockResolvedValue({ id: "event-1" }),
  getFlaggedEvents: vi.fn(),
  insertEventIdempotent: vi.fn().mockResolvedValue({ id: "event-2" }),
}));
vi.mock("@/server/repositories/membershipsRepository", () => ({
  getMemberships: vi.fn(),
  createMembershipAndInvite: vi.fn(),
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

const USER_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const EVENT_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";
const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";

function makeCaller(supabaseMock: any) {
  return appRouter.createCaller({
    user: { id: USER_ID, email: "actor@example.com" } as any,
    supabase: supabaseMock as any,
    req: undefined,
  });
}

// Build a chainable supabase mock that resolves with the given result.
// Supports: .from().upsert(), .from().delete().eq().eq(), .from().select().eq(),
// .from().select().eq().single(), .from().update().eq()
function makeChain(result: object) {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockResolvedValue(result);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  // reactions query resolves via the .eq() terminal (not .single())
  // We need the last .eq() to resolve — override after construction per test
  return chain;
}

// ─── react ────────────────────────────────────────────────────────────────────

describe("careEvents.react", () => {
  it("calls upsert on journal_reactions with correct args", async () => {
    const chain = makeChain({ data: null, error: null });
    const caller = makeCaller({ from: vi.fn().mockReturnValue(chain) });

    await caller.careEvents.react({ eventId: EVENT_ID, reaction: "heart" });

    expect(chain.upsert).toHaveBeenCalledWith(
      { event_id: EVENT_ID, user_id: USER_ID, reaction: "heart" },
      { onConflict: "event_id,user_id" },
    );
  });

  it("throws INTERNAL_SERVER_ERROR on supabase error", async () => {
    const chain = makeChain({ data: null, error: { message: "db error" } });
    const caller = makeCaller({ from: vi.fn().mockReturnValue(chain) });

    await expect(
      caller.careEvents.react({ eventId: EVENT_ID, reaction: "grateful" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── unreact ──────────────────────────────────────────────────────────────────

describe("careEvents.unreact", () => {
  it("calls delete with correct event_id and user_id filters", async () => {
    const chain = makeChain({ data: null, error: null });
    const supabaseMock = { from: vi.fn().mockReturnValue(chain) };
    const caller = makeCaller(supabaseMock);

    await caller.careEvents.unreact({ eventId: EVENT_ID });

    expect(supabaseMock.from).toHaveBeenCalledWith("journal_reactions");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("event_id", EVENT_ID);
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

// ─── reactions ────────────────────────────────────────────────────────────────

describe("careEvents.reactions", () => {
  it("returns correct counts and myReaction when user has reacted", async () => {
    const rows = [
      { reaction: "heart", user_id: USER_ID },
      { reaction: "heart", user_id: "other-user-id" },
    ];
    // reactions uses .select().eq() and resolves via the eq chain (not .single())
    // We need the terminal promise to be the result of the last chained call.
    const chain: any = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
    const caller = makeCaller({ from: vi.fn().mockReturnValue(chain) });

    const result = await caller.careEvents.reactions({ eventId: EVENT_ID });

    expect(result.counts).toEqual({ heart: 2 });
    expect(result.myReaction).toBe("heart");
  });

  it("returns null myReaction when user has not reacted", async () => {
    const rows = [{ reaction: "thinking_of_you", user_id: "someone-else" }];
    const chain: any = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockResolvedValue({ data: rows, error: null });
    const caller = makeCaller({ from: vi.fn().mockReturnValue(chain) });

    const result = await caller.careEvents.reactions({ eventId: EVENT_ID });

    expect(result.myReaction).toBeNull();
    expect(result.counts).toEqual({ thinking_of_you: 1 });
  });

  it("returns empty counts when no reactions exist", async () => {
    const chain: any = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockResolvedValue({ data: [], error: null });
    const caller = makeCaller({ from: vi.fn().mockReturnValue(chain) });

    const result = await caller.careEvents.reactions({ eventId: EVENT_ID });

    expect(result.counts).toEqual({});
    expect(result.myReaction).toBeNull();
  });
});

// ─── flag ─────────────────────────────────────────────────────────────────────

function makeAdminSelectChain(result: object) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

// ctx.supabase mock for flag: first call (care_events lookup) then update
function makeFlagSupabaseMock(eventData: any) {
  const selectChain: any = {};
  selectChain.select = vi.fn().mockReturnValue(selectChain);
  selectChain.eq = vi.fn().mockReturnValue(selectChain);
  selectChain.single = vi
    .fn()
    .mockResolvedValue({ data: eventData, error: null });

  const updateChain: any = {};
  updateChain.update = vi.fn().mockReturnValue(updateChain);
  updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null });

  // Merge both into a single from() that returns the right shape
  const combined: any = {};
  combined.select = vi.fn().mockReturnValue(selectChain);
  combined.update = vi.fn().mockReturnValue(updateChain);
  combined.eq = vi.fn().mockReturnValue(combined);

  return { from: vi.fn().mockReturnValue(combined) };
}

describe("careEvents.flag", () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin.from).mockReset();
  });

  it("allows coordinator to flag without throwing", async () => {
    const supabaseMock = makeFlagSupabaseMock({ id: EVENT_ID, org_id: ORG_ID });
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeAdminSelectChain({
        data: { role: "coordinator" },
        error: null,
      }) as any,
    );
    const caller = makeCaller(supabaseMock);

    await expect(
      caller.careEvents.flag({ eventId: EVENT_ID, flagged: true }),
    ).resolves.not.toThrow();
  });

  it("throws FORBIDDEN for non-coordinator", async () => {
    const supabaseMock = makeFlagSupabaseMock({ id: EVENT_ID, org_id: ORG_ID });
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeAdminSelectChain({ data: { role: "caregiver" }, error: null }) as any,
    );
    const caller = makeCaller(supabaseMock);

    await expect(
      caller.careEvents.flag({ eventId: EVENT_ID, flagged: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws NOT_FOUND for missing event", async () => {
    const supabaseMock = makeFlagSupabaseMock(null);
    const caller = makeCaller(supabaseMock);

    await expect(
      caller.careEvents.flag({ eventId: EVENT_ID, flagged: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
