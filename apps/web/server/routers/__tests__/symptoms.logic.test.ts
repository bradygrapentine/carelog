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
const REC_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

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
    limit: () => chain,
  };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeListChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    order: () => chain,
    limit: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

function makeDedupChain(data: object | null) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    lte: () => chain,
  };
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

// ─── symptoms.list — business logic ──────────────────────────────────────────

describe("symptoms.list — business logic", () => {
  it("returns readings for the given recipient in descending order", async () => {
    const sampleData = [
      {
        id: "r2",
        pain_level: 8,
        mood: "bad",
        recorded_at: "2026-04-10T00:00:00Z",
      },
      {
        id: "r1",
        pain_level: 4,
        mood: "okay",
        recorded_at: "2026-04-09T00:00:00Z",
      },
    ];
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "caregiver" }, error: null });
      return makeListChain({ data: sampleData, error: null });
    });

    const result = await authedCaller.symptoms.list({
      org_id: ORG_ID,
      recipient_id: REC_ID,
    });
    expect(result).toEqual(sampleData);
  });

  it("returns empty array when no readings exist", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeListChain({ data: null, error: null });
    });

    const result = await authedCaller.symptoms.list({
      org_id: ORG_ID,
      recipient_id: REC_ID,
    });
    expect(result).toEqual([]);
  });

  it("throws INTERNAL_SERVER_ERROR when DB read fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "caregiver" }, error: null });
      return makeListChain({ data: null, error: { message: "db error" } });
    });

    await expect(
      authedCaller.symptoms.list({ org_id: ORG_ID, recipient_id: REC_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── symptoms.log — business logic ───────────────────────────────────────────

describe("symptoms.log — business logic", () => {
  const logInput = {
    org_id: ORG_ID,
    recipient_id: REC_ID,
    pain_level: 7,
    mood: "difficult" as const,
  };

  it("inserts a reading with logged_by set to ctx.user.id", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      if (callCount === 2) return makeDedupChain(null); // dedup: no duplicate
      return { insert: insertFn } as any;
    });

    const result = await authedCaller.symptoms.log(logInput);
    expect(result).toEqual({ ok: true });
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        logged_by: USER_ID,
        org_id: ORG_ID,
        recipient_id: REC_ID,
      }),
    );
  });

  it("returns ok without inserting when duplicate within 30-min window", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeDedupChain({ id: "existing-1" }); // dedup: duplicate found
    });

    const result = await authedCaller.symptoms.log(logInput);
    expect(result).toEqual({ ok: true });
    expect(callCount).toBe(2); // no insert call
  });

  it("throws INTERNAL_SERVER_ERROR when insert fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      if (callCount === 2) return makeDedupChain(null);
      return {
        insert: vi
          .fn()
          .mockResolvedValue({ error: { message: "insert failed" } }),
      } as any;
    });

    await expect(authedCaller.symptoms.log(logInput)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
