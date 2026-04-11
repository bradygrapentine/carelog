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
  insertEvent: vi.fn(),
  getFlaggedEvents: vi.fn(),
  insertEventIdempotent: vi.fn(),
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

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const RECIPIENT_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const USER_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const EXPENSE_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

const caller = appRouter.createCaller({
  user: { id: USER_ID, email: "actor@example.com" } as any,
  supabase: {} as any,
  req: undefined,
});

function makeTwoCallChain(membershipResult: object, dataResult: object) {
  let callIndex = 0;
  const membershipChain: any = {
    select: () => membershipChain,
    eq: () => membershipChain,
    not: () => membershipChain,
    single: vi.fn().mockResolvedValue(membershipResult),
  };
  const dataChain: any = {
    select: () => dataChain,
    eq: () => dataChain,
    order: () => dataChain,
    gte: () => dataChain,
    insert: vi.fn().mockResolvedValue(dataResult),
    delete: () => dataChain,
  };
  dataChain.eq = () => dataChain;
  dataChain.then = (resolve: any) => resolve(dataResult);

  vi.mocked(supabaseAdmin.from).mockImplementation(() => {
    callIndex++;
    if (callIndex === 1) return membershipChain;
    return dataChain;
  });

  return { membershipChain, dataChain };
}

const baseListInput = { org_id: ORG_ID, recipient_id: RECIPIENT_ID };
const baseCreateInput = {
  org_id: ORG_ID,
  recipient_id: RECIPIENT_ID,
  amount: 100,
  category: "medication" as const,
  description: "Monthly meds",
};
const baseDeleteInput = { id: EXPENSE_ID, org_id: ORG_ID };

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

// ─── expenses.list — business logic ──────────────────────────────────────────

describe("expenses.list — business logic", () => {
  it("returns expenses for the org/recipient", async () => {
    const sampleExpenses = [{ id: EXPENSE_ID, amount: 100 }];
    makeTwoCallChain(
      { data: { role: "caregiver" }, error: null },
      { data: sampleExpenses, error: null },
    );

    const result = await caller.expenses.list(baseListInput);
    expect(result).toEqual(sampleExpenses);
  });

  it("returns empty array when no expenses exist", async () => {
    makeTwoCallChain(
      { data: { role: "coordinator" }, error: null },
      { data: null, error: null },
    );

    const result = await caller.expenses.list(baseListInput);
    expect(result).toEqual([]);
  });

  it("applies since filter when provided", async () => {
    const since = "2026-01-01";
    const sampleExpenses = [{ id: EXPENSE_ID, amount: 50 }];

    let callIndex = 0;
    const membershipChain: any = {
      select: () => membershipChain,
      eq: () => membershipChain,
      not: () => membershipChain,
      single: vi
        .fn()
        .mockResolvedValue({ data: { role: "coordinator" }, error: null }),
    };
    const gteFn = vi.fn().mockReturnThis();
    const dataChain: any = {
      select: () => dataChain,
      eq: () => dataChain,
      order: () => dataChain,
      gte: gteFn,
      then: (resolve: any) => resolve({ data: sampleExpenses, error: null }),
    };
    dataChain.eq = () => dataChain;

    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return membershipChain;
      return dataChain;
    });

    const result = await caller.expenses.list({ ...baseListInput, since });
    expect(result).toEqual(sampleExpenses);
    expect(gteFn).toHaveBeenCalledWith("incurred_at", since);
  });

  it("throws INTERNAL_SERVER_ERROR when DB read fails", async () => {
    makeTwoCallChain(
      { data: { role: "caregiver" }, error: null },
      { data: null, error: { message: "db error" } },
    );

    await expect(caller.expenses.list(baseListInput)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});

// ─── expenses.create — business logic ────────────────────────────────────────

describe("expenses.create — business logic", () => {
  it("inserts expense with logged_by set to ctx.user.id", async () => {
    let callIndex = 0;
    const membershipChain: any = {
      select: () => membershipChain,
      eq: () => membershipChain,
      not: () => membershipChain,
      single: vi
        .fn()
        .mockResolvedValue({ data: { role: "coordinator" }, error: null }),
    };
    const insertFn = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return membershipChain;
      return { insert: insertFn } as any;
    });

    const result = await caller.expenses.create(baseCreateInput);
    expect(result).toEqual({ ok: true });
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ logged_by: USER_ID, org_id: ORG_ID }),
    );
  });

  it("throws INTERNAL_SERVER_ERROR when insert fails", async () => {
    makeTwoCallChain(
      { data: { role: "coordinator" }, error: null },
      { error: { message: "insert error" } },
    );

    await expect(caller.expenses.create(baseCreateInput)).rejects.toMatchObject(
      { code: "INTERNAL_SERVER_ERROR" },
    );
  });
});

// ─── expenses.delete — business logic ────────────────────────────────────────

describe("expenses.delete — business logic", () => {
  it("removes expense by id and org_id, returns ok", async () => {
    makeTwoCallChain(
      { data: { role: "coordinator" }, error: null },
      { error: null },
    );

    const result = await caller.expenses.delete(baseDeleteInput);
    expect(result).toEqual({ ok: true });
  });

  it("throws INTERNAL_SERVER_ERROR when delete fails", async () => {
    makeTwoCallChain(
      { data: { role: "coordinator" }, error: null },
      { error: { message: "delete error" } },
    );

    await expect(caller.expenses.delete(baseDeleteInput)).rejects.toMatchObject(
      { code: "INTERNAL_SERVER_ERROR" },
    );
  });
});
