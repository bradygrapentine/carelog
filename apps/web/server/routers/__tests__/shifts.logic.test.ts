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
const SHIFT_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const REC_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

const START = "2026-04-08T08:00:00.000Z";
const END = "2026-04-08T16:00:00.000Z";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

function makeSelectChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

// Coordinator membership chain
function makeCoordinatorChain() {
  const chain: any = { select: () => chain, eq: () => chain };
  chain.single = vi.fn().mockResolvedValue({
    data: { role: "coordinator", accepted_at: "2026-01-01" },
    error: null,
  });
  return chain;
}

// Accepted member chain (for requireAssigneeInOrg)
function makeAcceptedMemberChain() {
  const chain: any = { select: () => chain, eq: () => chain, not: () => chain };
  chain.single = vi
    .fn()
    .mockResolvedValue({ data: { user_id: USER_ID }, error: null });
  return chain;
}

// Overlap check chain — no overlap by default
function makeNoOverlapChain() {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    lt: () => chain,
    gt: () => chain,
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return chain;
}

// Mutation chain (.insert/.update + .select().single())
function makeAdminMutationChain(result: object) {
  const chain: any = {
    insert: () => chain,
    update: () => chain,
    select: () => chain,
    eq: () => chain,
  };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

// List chain for supabaseAdmin insert returning array (.select() without .single())
function makeAdminInsertArrayChain(result: object) {
  const chain: any = { insert: () => chain };
  chain.select = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

// ─── shifts.list ─────────────────────────────────────────────────────────────

describe("shifts.list — logic", () => {
  it("returns empty array when no shifts exist", async () => {
    const ctxSupabase = { from: vi.fn() } as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase,
      req: undefined,
    });
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      range: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(ctxSupabase.from).mockReturnValue(chain);
    const result = await caller.shifts.list({
      org_id: ORG_ID,
      recipient_id: REC_ID,
      from: START,
      to: END,
      limit: 50,
    });
    expect(result).toEqual([]);
  });

  it("returns shifts within date range", async () => {
    const shift = {
      id: SHIFT_ID,
      org_id: ORG_ID,
      start_at: START,
      end_at: END,
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
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      range: vi.fn().mockResolvedValue({ data: [shift], error: null }),
    };
    vi.mocked(ctxSupabase.from).mockReturnValue(chain);
    const result = await caller.shifts.list({
      org_id: ORG_ID,
      recipient_id: REC_ID,
      from: START,
      to: END,
      limit: 50,
    });
    expect(result).toEqual([shift]);
    expect(vi.mocked(ctxSupabase.from)).toHaveBeenCalledWith("shifts");
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
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      range: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "db error" } }),
    };
    vi.mocked(ctxSupabase.from).mockReturnValue(chain);
    await expect(
      caller.shifts.list({
        org_id: ORG_ID,
        recipient_id: REC_ID,
        from: START,
        to: END,
        limit: 50,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── shifts.create (single) ──────────────────────────────────────────────────

describe("shifts.create (single) — logic", () => {
  const createInput = {
    org_id: ORG_ID,
    recipient_id: REC_ID,
    assignee_user_id: USER_ID,
    start_at: START,
    end_at: END,
  };
  const createdShift = { id: SHIFT_ID, ...createInput, status: "scheduled" };

  it("creates a single shift with status=scheduled", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain(); // requireCoordinator
      if (callCount === 2) return makeAcceptedMemberChain(); // requireAssigneeInOrg
      if (callCount === 3) return makeNoOverlapChain(); // overlap check
      return makeAdminMutationChain({ data: createdShift, error: null });
    });
    const result = await authedCaller.shifts.create(createInput);
    expect(result).toEqual(createdShift);
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith("shifts");
  });

  it("throws CONFLICT when assignee has overlapping shift", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      if (callCount === 2) return makeAcceptedMemberChain();
      // overlap chain with existing shift
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        neq: () => chain,
        lt: () => chain,
        gt: () => chain,
        limit: vi
          .fn()
          .mockResolvedValue({ data: [{ id: "existing-shift" }], error: null }),
      };
      return chain;
    });
    await expect(authedCaller.shifts.create(createInput)).rejects.toMatchObject(
      { code: "CONFLICT" },
    );
  });

  it("throws INTERNAL_SERVER_ERROR when insert fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      if (callCount === 2) return makeAcceptedMemberChain();
      if (callCount === 3) return makeNoOverlapChain();
      return makeAdminMutationChain({
        data: null,
        error: { message: "insert failed" },
      });
    });
    await expect(authedCaller.shifts.create(createInput)).rejects.toMatchObject(
      { code: "INTERNAL_SERVER_ERROR" },
    );
  });
});

// ─── shifts.create (recurring) ───────────────────────────────────────────────

describe("shifts.create (recurring) — logic", () => {
  const recurringInput = {
    org_id: ORG_ID,
    recipient_id: REC_ID,
    assignee_user_id: USER_ID,
    start_at: START,
    end_at: END,
    recurrence: { freq: "weekly" as const, weeks: 3 },
  };

  it("bulk-inserts N shifts for a recurring series", async () => {
    const seriesShifts = [
      { id: "shift-1", status: "scheduled" },
      { id: "shift-2", status: "scheduled" },
      { id: "shift-3", status: "scheduled" },
    ];
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      if (callCount === 2) return makeAcceptedMemberChain();
      return makeAdminInsertArrayChain({ data: seriesShifts, error: null });
    });
    const result = await authedCaller.shifts.create(recurringInput);
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[]).length).toBe(3);
  });
});

// ─── shifts.update ───────────────────────────────────────────────────────────

describe("shifts.update — logic", () => {
  it("updates shift status and returns updated record", async () => {
    const updated = { id: SHIFT_ID, org_id: ORG_ID, status: "completed" };
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCoordinatorChain();
      return makeAdminMutationChain({ data: updated, error: null });
    });
    const result = await authedCaller.shifts.update({
      id: SHIFT_ID,
      org_id: ORG_ID,
      status: "completed",
    });
    expect(result).toEqual(updated);
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
      authedCaller.shifts.update({
        id: SHIFT_ID,
        org_id: ORG_ID,
        status: "completed",
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── shifts.upsertHandoff (UX-101b) ──────────────────────────────────────────

describe("shifts.upsertHandoff — UX-101b", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeShiftFetchChain(
    shift: {
      id: string;
      org_id: string;
      assignee_user_id: string | null;
    } | null,
  ) {
    const chain: any = { select: () => chain, eq: () => chain };
    chain.single = vi.fn().mockResolvedValue({
      data: shift,
      error: shift ? null : { message: "not found" },
    });
    return chain;
  }

  function makeMembershipMaybeSingleChain(
    member: { role: string; accepted_at: string } | null,
  ) {
    const chain: any = { select: () => chain, eq: () => chain };
    chain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: member, error: null });
    return chain;
  }

  function makeUpsertChain(result: { data: unknown; error: unknown }) {
    const chain: any = {
      update: () => chain,
      eq: () => chain,
      select: () => chain,
    };
    chain.single = vi.fn().mockResolvedValue(result);
    return chain;
  }

  it("allows the shift's assignee to write the handoff", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeShiftFetchChain({
          id: SHIFT_ID,
          org_id: ORG_ID,
          assignee_user_id: USER_ID,
        });
      }
      return makeUpsertChain({
        data: { id: SHIFT_ID, handoff_entries: [{ body: "slept 6h" }] },
        error: null,
      });
    });

    const result = await authedCaller.shifts.upsertHandoff({
      shiftId: SHIFT_ID,
      entries: [{ body: "slept 6h" }],
    });

    expect(result).toMatchObject({ id: SHIFT_ID });
    expect(callCount).toBe(2);
  });

  it("allows a coordinator (non-assignee) to write the handoff", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeShiftFetchChain({
          id: SHIFT_ID,
          org_id: ORG_ID,
          assignee_user_id: "other-user-id",
        });
      }
      if (callCount === 2) {
        return makeMembershipMaybeSingleChain({
          role: "coordinator",
          accepted_at: "2026-01-01",
        });
      }
      return makeUpsertChain({
        data: { id: SHIFT_ID, handoff_entries: [{ body: "x" }] },
        error: null,
      });
    });

    const result = await authedCaller.shifts.upsertHandoff({
      shiftId: SHIFT_ID,
      entries: [{ body: "x" }],
    });

    expect(result).toMatchObject({ id: SHIFT_ID });
  });

  it("throws FORBIDDEN when caller is neither assignee nor coordinator", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeShiftFetchChain({
          id: SHIFT_ID,
          org_id: ORG_ID,
          assignee_user_id: "other-user-id",
        });
      }
      return makeMembershipMaybeSingleChain({
        role: "caregiver",
        accepted_at: "2026-01-01",
      });
    });

    await expect(
      authedCaller.shifts.upsertHandoff({
        shiftId: SHIFT_ID,
        entries: [{ body: "nope" }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws NOT_FOUND when the shift does not exist", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() =>
      makeShiftFetchChain(null),
    );

    await expect(
      authedCaller.shifts.upsertHandoff({
        shiftId: SHIFT_ID,
        entries: [{ body: "x" }],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects entries[].body over 2000 chars via Zod", async () => {
    await expect(
      authedCaller.shifts.upsertHandoff({
        shiftId: SHIFT_ID,
        entries: [{ body: "x".repeat(2001) }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it("rejects more than 10 entries via Zod", async () => {
    await expect(
      authedCaller.shifts.upsertHandoff({
        shiftId: SHIFT_ID,
        entries: Array.from({ length: 11 }, () => ({ body: "x" })),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── shifts.getLatestHandoff (UX-101b) ───────────────────────────────────────

describe("shifts.getLatestHandoff — UX-101b", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeListChain(result: { data: unknown; error: unknown }) {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      lt: () => chain,
      neq: () => chain,
      order: () => chain,
      limit: () => chain,
    };
    chain.maybeSingle = vi.fn().mockResolvedValue(result);
    return chain;
  }

  it("returns the latest non-empty handoff for the recipient", async () => {
    const handoff = {
      id: SHIFT_ID,
      end_at: "2026-05-08T10:00:00.000Z",
      assignee_user_id: USER_ID,
      handoff_entries: [{ body: "all good" }],
    };
    const ctxSupabase = {
      from: vi
        .fn()
        .mockReturnValue(makeListChain({ data: handoff, error: null })),
    } as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase,
      req: undefined,
    });

    const result = await caller.shifts.getLatestHandoff({
      recipientId: REC_ID,
    });

    expect(result).toEqual(handoff);
    expect(ctxSupabase.from).toHaveBeenCalledWith("shifts");
  });

  it("returns null when no past shift has a handoff", async () => {
    const ctxSupabase = {
      from: vi.fn().mockReturnValue(makeListChain({ data: null, error: null })),
    } as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase,
      req: undefined,
    });

    const result = await caller.shifts.getLatestHandoff({
      recipientId: REC_ID,
    });

    expect(result).toBeNull();
  });

  it("rejects non-uuid recipientId via Zod", async () => {
    await expect(
      authedCaller.shifts.getLatestHandoff({
        recipientId: "not-a-uuid",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
