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
const REC_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const MED_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const USER_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

// Build a full supabaseAdmin chain for mutations (insert/update with .select().single())
function makeAdminMutationChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    insert: () => chain,
    update: () => chain,
  };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

// Update chain that doesn't end in .single()
function makeAdminUpdateChain(result: object) {
  const chain: any = {
    eq: () => chain,
    update: () => chain,
    select: () => chain,
  };
  chain.single = vi.fn().mockResolvedValue(result);
  // make the chain itself awaitable (for delete which has no .select)
  chain.then = (resolve: any) => Promise.resolve(result).then(resolve);
  return chain;
}

// Build a membership select chain (for requireCoordinator) that returns coordinator
function makeCoordinatorChain() {
  const chain: any = { select: () => chain, eq: () => chain };
  chain.single = vi
    .fn()
    .mockResolvedValue({
      data: { role: "coordinator", accepted_at: "2026-01-01" },
      error: null,
    });
  return chain;
}

// RLS-scoped ctx.supabase chain
function makeCtxChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    contains: () => chain,
    gte: () => chain,
    order: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

// ─── medications.list ────────────────────────────────────────────────────────

describe("medications.list — logic", () => {
  it("returns empty array when no medications exist", async () => {
    const ctxSupabase = { from: vi.fn() } as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase,
      req: undefined,
    });
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(ctxSupabase.from).mockReturnValue(chain);
    const result = await caller.medications.list({
      org_id: ORG_ID,
      recipient_id: REC_ID,
    });
    expect(result).toEqual([]);
  });

  it("returns medications filtered by org_id and recipient_id", async () => {
    const med = {
      id: MED_ID,
      drug_name: "Lisinopril",
      dosage: "10mg",
      org_id: ORG_ID,
      recipient_id: REC_ID,
      active: true,
    };
    const ctxSupabase = { from: vi.fn() } as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase,
      req: undefined,
    });
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: vi.fn().mockResolvedValue({ data: [med], error: null }),
    };
    vi.mocked(ctxSupabase.from).mockReturnValue(chain);
    const result = await caller.medications.list({
      org_id: ORG_ID,
      recipient_id: REC_ID,
    });
    expect(result).toEqual([med]);
    expect(vi.mocked(ctxSupabase.from)).toHaveBeenCalledWith("medications");
  });

  it("throws INTERNAL_SERVER_ERROR on supabase error", async () => {
    const ctxSupabase = { from: vi.fn() } as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase,
      req: undefined,
    });
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "db error" } }),
    };
    vi.mocked(ctxSupabase.from).mockReturnValue(chain);
    await expect(
      caller.medications.list({ org_id: ORG_ID, recipient_id: REC_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── medications.create ──────────────────────────────────────────────────────

describe("medications.create — logic", () => {
  const createInput = {
    org_id: ORG_ID,
    recipient_id: REC_ID,
    drug_name: "Lisinopril",
    dosage: "10mg",
  };
  const createdMed = {
    id: MED_ID,
    ...createInput,
    active: true,
    scan_source: "manual",
  };

  it("inserts medication and returns created record", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain(); // requireCoordinator
      return makeAdminMutationChain({ data: createdMed, error: null });
    });
    const result = await authedCaller.medications.create(createInput);
    expect(result).toEqual(createdMed);
  });

  it('sets scan_source to "manual" and active to true', async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      return makeAdminMutationChain({ data: createdMed, error: null });
    });
    const result = await authedCaller.medications.create(createInput);
    expect(result.scan_source).toBe("manual");
    expect(result.active).toBe(true);
  });

  it("throws INTERNAL_SERVER_ERROR when insert fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      return makeAdminMutationChain({
        data: null,
        error: { message: "insert failed" },
      });
    });
    await expect(
      authedCaller.medications.create(createInput),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── medications.update ──────────────────────────────────────────────────────

describe("medications.update — logic", () => {
  const updateInput = { id: MED_ID, org_id: ORG_ID, supply_days_remaining: 14 };
  const updatedMed = {
    id: MED_ID,
    org_id: ORG_ID,
    supply_days_remaining: 14,
    drug_name: "Lisinopril",
  };

  it("updates medication and returns updated record", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      return makeAdminMutationChain({ data: updatedMed, error: null });
    });
    const result = await authedCaller.medications.update(updateInput);
    expect(result).toEqual(updatedMed);
  });

  it("throws INTERNAL_SERVER_ERROR when update fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      return makeAdminMutationChain({
        data: null,
        error: { message: "update failed" },
      });
    });
    await expect(
      authedCaller.medications.update(updateInput),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── medications.delete ──────────────────────────────────────────────────────

describe("medications.delete — logic", () => {
  it("soft-deletes medication by setting active=false and returns success", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      // delete uses .update().eq().eq() with no .select()
      const chain: any = { eq: () => chain, update: () => chain };
      chain.then = (resolve: any) =>
        Promise.resolve({ error: null }).then(resolve);
      return chain;
    });
    const result = await authedCaller.medications.delete({
      id: MED_ID,
      org_id: ORG_ID,
    });
    expect(result).toEqual({ success: true });
  });

  it("throws INTERNAL_SERVER_ERROR when delete fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      const chain: any = { eq: () => chain, update: () => chain };
      chain.then = (resolve: any) =>
        Promise.resolve({ error: { message: "delete failed" } }).then(resolve);
      return chain;
    });
    await expect(
      authedCaller.medications.delete({ id: MED_ID, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── medications.logAdministration ───────────────────────────────────────────

describe("medications.logAdministration — logic", () => {
  const logInput = {
    org_id: ORG_ID,
    recipient_id: REC_ID,
    medication_id: MED_ID,
    scheduled_time: "08:00:00",
    action: "given" as const,
  };
  const careEvent = {
    id: "evt-1",
    event_type: "medication",
    entry_kind: "system",
  };

  it("inserts a care event with event_type=medication and returns it", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain(); // membership check
      return makeAdminMutationChain({ data: careEvent, error: null });
    });
    const result = await authedCaller.medications.logAdministration(logInput);
    expect(result).toEqual(careEvent);
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith("care_events");
  });

  it("throws INTERNAL_SERVER_ERROR when care_events insert fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      return makeAdminMutationChain({
        data: null,
        error: { message: "insert failed" },
      });
    });
    await expect(
      authedCaller.medications.logAdministration(logInput),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
