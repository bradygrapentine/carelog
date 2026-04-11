import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
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

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const USER_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const WEEK_STAMP = "2026-W15";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

function makeSelectChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    order: () => chain,
    limit: vi.fn().mockResolvedValue(result),
  };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeUpsertChain(result: object) {
  return { upsert: vi.fn().mockResolvedValue(result) } as any;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

// ─── burnout.checkIn ─────────────────────────────────────────────────────────

describe("burnout.checkIn — logic", () => {
  const checkInInput = {
    org_id: ORG_ID,
    user_id: USER_ID,
    sleep_score: 4,
    stress_score: 2,
    support_score: 5,
    week_stamp: WEEK_STAMP,
  };

  it("upserts a check-in and returns { upserted: true }", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeUpsertChain({ error: null }),
    );
    const result = await authedCaller.burnout.checkIn(checkInInput);
    expect(result).toEqual({ upserted: true });
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith(
      "burnout_checkins",
    );
  });

  it("uses upsert with onConflict user_id,week_stamp", async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue({ upsert: upsertFn } as any);
    await authedCaller.burnout.checkIn(checkInInput);
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, week_stamp: WEEK_STAMP }),
      { onConflict: "user_id,week_stamp" },
    );
  });

  it("throws INTERNAL_SERVER_ERROR when upsert fails", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeUpsertChain({ error: { message: "upsert failed" } }),
    );
    await expect(
      authedCaller.burnout.checkIn(checkInInput),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── burnout.myHistory ────────────────────────────────────────────────────────

describe("burnout.myHistory — logic", () => {
  it("returns check-ins for the authenticated user", async () => {
    const rows = [
      {
        id: "row-1",
        user_id: USER_ID,
        org_id: ORG_ID,
        week_stamp: WEEK_STAMP,
        sleep_score: 3,
        stress_score: 3,
        support_score: 4,
      },
      {
        id: "row-2",
        user_id: USER_ID,
        org_id: ORG_ID,
        week_stamp: "2026-W14",
        sleep_score: 4,
        stress_score: 2,
        support_score: 5,
      },
    ];
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: rows, error: null }),
    );
    const result = await authedCaller.burnout.myHistory({ org_id: ORG_ID });
    expect(result).toEqual(rows);
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith(
      "burnout_checkins",
    );
  });

  it("returns empty array when no history exists", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: null }),
    );
    const result = await authedCaller.burnout.myHistory({ org_id: ORG_ID });
    expect(result).toEqual([]);
  });

  it("throws INTERNAL_SERVER_ERROR on query error", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { message: "query failed" } }),
    );
    await expect(
      authedCaller.burnout.myHistory({ org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── burnout.orgSummary ───────────────────────────────────────────────────────

describe("burnout.orgSummary — logic", () => {
  it("aggregates check-ins by week and returns averages", async () => {
    const sampleRows = [
      {
        week_stamp: WEEK_STAMP,
        sleep_score: 4,
        stress_score: 2,
        support_score: 5,
      },
      {
        week_stamp: WEEK_STAMP,
        sleep_score: 2,
        stress_score: 4,
        support_score: 3,
      },
      {
        week_stamp: WEEK_STAMP,
        sleep_score: 3,
        stress_score: 3,
        support_score: 4,
      },
    ];
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeSelectChain({ data: sampleRows, error: null });
    });
    const result = await authedCaller.burnout.orgSummary({ org_id: ORG_ID });
    expect(result).toHaveLength(1);
    expect(result[0].week_stamp).toBe(WEEK_STAMP);
    expect(result[0].count).toBe(3);
    expect(result[0].avg_sleep).toBeCloseTo(3);
    expect(result[0].avg_stress).toBeCloseTo(3);
    expect(result[0].avg_support).toBeCloseTo(4);
  });

  it("suppresses weeks with fewer than 3 check-ins (de-anonymization guard)", async () => {
    const sparseRows = [
      {
        week_stamp: WEEK_STAMP,
        sleep_score: 4,
        stress_score: 2,
        support_score: 5,
      },
      {
        week_stamp: WEEK_STAMP,
        sleep_score: 2,
        stress_score: 4,
        support_score: 3,
      },
      // only 2 rows — below MIN_GROUP threshold of 3
    ];
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeSelectChain({ data: sparseRows, error: null });
    });
    const result = await authedCaller.burnout.orgSummary({ org_id: ORG_ID });
    expect(result).toHaveLength(0);
  });

  it("returns empty array when no check-ins exist", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeSelectChain({ data: [], error: null });
    });
    const result = await authedCaller.burnout.orgSummary({ org_id: ORG_ID });
    expect(result).toEqual([]);
  });

  it("throws INTERNAL_SERVER_ERROR when query fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeSelectChain({
        data: null,
        error: { message: "query failed" },
      });
    });
    await expect(
      authedCaller.burnout.orgSummary({ org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
