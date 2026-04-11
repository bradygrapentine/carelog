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

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

const screenInput = {
  org_id: ORG_ID,
  recipient_id: REC_ID,
  answers: {
    age65plus: true,
    veteran: false,
    lowIncome: true,
    medicareEnrolled: false,
    medicaidEnrolled: false,
  },
  results: [
    {
      key: "snap",
      name: "SNAP",
      description: "Food assistance",
      applyUrl: "https://snap.gov",
    },
  ],
};

// ─── benefits.screen — business logic ────────────────────────────────────────

describe("benefits.screen — business logic", () => {
  it("returns { ok: true } when insert succeeds", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as any;
    });

    const result = await authedCaller.benefits.screen(screenInput);
    expect(result).toEqual({ ok: true });
  });

  it("inserts with created_by: ctx.user.id", async () => {
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return { insert: insertFn } as any;
    });

    await authedCaller.benefits.screen(screenInput);
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: USER_ID,
        org_id: ORG_ID,
        recipient_id: REC_ID,
        answers: screenInput.answers,
        results: screenInput.results,
      }),
    );
  });

  it("throws INTERNAL_SERVER_ERROR when insert fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return {
        insert: vi
          .fn()
          .mockResolvedValue({ error: { message: "insert failed" } }),
      } as any;
    });

    await expect(
      authedCaller.benefits.screen(screenInput),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── benefits.latest — business logic ────────────────────────────────────────

describe("benefits.latest — business logic", () => {
  const latestInput = { org_id: ORG_ID, recipient_id: REC_ID };

  it("returns most recent screening when one exists", async () => {
    const screening = {
      id: "s1",
      org_id: ORG_ID,
      recipient_id: REC_ID,
      results: screenInput.results,
    };
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeSelectChain({ data: screening, error: null });
    });

    const result = await authedCaller.benefits.latest(latestInput);
    expect(result).toEqual(screening);
  });

  it("returns null when no screening exists (PGRST116)", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeSelectChain({
        data: null,
        error: { code: "PGRST116", message: "no rows" },
      });
    });

    const result = await authedCaller.benefits.latest(latestInput);
    expect(result).toBeNull();
  });

  it("throws INTERNAL_SERVER_ERROR when DB read fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeSelectChain({
        data: null,
        error: { code: "42P01", message: "table missing" },
      });
    });

    await expect(
      authedCaller.benefits.latest(latestInput),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
