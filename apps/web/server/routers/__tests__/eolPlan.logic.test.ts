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
  const chain: any = { select: () => chain, eq: () => chain, not: () => chain };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

const upsertBase = {
  org_id: ORG_ID,
  recipient_id: REC_ID,
  healthcare_proxy: "Jane Doe",
  resuscitation_pref: "dnr" as const,
  funeral_pref: "Cremation",
  legacy_message: "Thank you.",
  attorney_name: "John Smith",
  attorney_contact: "555-1234",
};

// ─── eolPlan.get — business logic ────────────────────────────────────────────

describe("eolPlan.get — business logic", () => {
  it("returns plan data when it exists", async () => {
    const plan = {
      id: "plan-1",
      org_id: ORG_ID,
      recipient_id: REC_ID,
      resuscitation_pref: "dnr",
    };
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeSelectChain({ data: plan, error: null });
    });

    const result = await authedCaller.eolPlan.get({
      org_id: ORG_ID,
      recipient_id: REC_ID,
    });
    expect(result).toEqual(plan);
  });

  it("returns null when no plan exists (PGRST116)", async () => {
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

    const result = await authedCaller.eolPlan.get({
      org_id: ORG_ID,
      recipient_id: REC_ID,
    });
    expect(result).toBeNull();
  });

  it("throws INTERNAL_SERVER_ERROR when DB returns a non-PGRST116 error", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeSelectChain({
        data: null,
        error: { code: "42P01", message: "relation missing" },
      });
    });

    await expect(
      authedCaller.eolPlan.get({ org_id: ORG_ID, recipient_id: REC_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── eolPlan.upsert — business logic ─────────────────────────────────────────

describe("eolPlan.upsert — business logic", () => {
  it("returns { ok: true } when upsert succeeds", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      if (callCount === 2)
        return makeSelectChain({ data: { id: REC_ID }, error: null });
      return { upsert: vi.fn().mockResolvedValue({ error: null }) } as any;
    });

    const result = await authedCaller.eolPlan.upsert(upsertBase);
    expect(result).toEqual({ ok: true });
  });

  it("sends created_by: ctx.user.id in the upsert payload", async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null });
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      if (callCount === 2)
        return makeSelectChain({ data: { id: REC_ID }, error: null });
      return { upsert: upsertFn } as any;
    });

    await authedCaller.eolPlan.upsert(upsertBase);
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: USER_ID }),
      expect.objectContaining({ onConflict: "recipient_id" }),
    );
  });

  it("throws INTERNAL_SERVER_ERROR when upsert fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      if (callCount === 2)
        return makeSelectChain({ data: { id: REC_ID }, error: null });
      return {
        upsert: vi
          .fn()
          .mockResolvedValue({ error: { message: "write failed" } }),
      } as any;
    });

    await expect(authedCaller.eolPlan.upsert(upsertBase)).rejects.toMatchObject(
      { code: "INTERNAL_SERVER_ERROR" },
    );
  });
});
