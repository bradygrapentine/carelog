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

// Builds a chain that supports: .select().eq().eq().not().single()
// and .select('*').eq().eq().order() and .insert() and .delete().eq().eq()
function makeSelectChain(membershipResult: object, dataResult?: object) {
  let callCount = 0;
  const chain: any = {
    select: () => {
      callCount++;
      return chain;
    },
    eq: () => chain,
    not: () => chain,
    order: () => chain,
    gte: () => chain,
    insert: vi.fn().mockResolvedValue(dataResult ?? { error: null }),
    delete: () => chain,
  };
  chain.single = vi.fn().mockImplementation(() => {
    // First call is always membership check
    return Promise.resolve(membershipResult);
  });
  // For list queries that don't call .single()
  chain.then = (resolve: any) =>
    resolve(dataResult ?? { data: [], error: null });
  return chain;
}

// Builds two separate chains: one for membership, one for the data query
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
  // delete chain needs eq chained after delete
  dataChain.eq = () => dataChain;
  dataChain.then = (resolve: any) => resolve(dataResult);

  vi.mocked(supabaseAdmin.from).mockImplementation(() => {
    callIndex++;
    if (callIndex === 1) return membershipChain;
    return dataChain;
  });
}

const baseListInput = {
  org_id: ORG_ID,
  recipient_id: RECIPIENT_ID,
};

const baseCreateInput = {
  org_id: ORG_ID,
  recipient_id: RECIPIENT_ID,
  amount: 100,
  category: "medication" as const,
  description: "Monthly meds",
};

const baseDeleteInput = {
  id: EXPENSE_ID,
  org_id: ORG_ID,
};

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

// ─── expenses.list ────────────────────────────────────────────────────────────

describe("expenses.list — authorization", () => {
  it("throws FORBIDDEN when user is not a member (membership returns null)", async () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain);
    await expect(caller.expenses.list(baseListInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns data when user is a member (any role)", async () => {
    makeTwoCallChain(
      { data: { role: "caregiver" }, error: null },
      { data: [{ id: EXPENSE_ID }], error: null },
    );
    const result = await caller.expenses.list(baseListInput);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── expenses.create — role enforcement ───────────────────────────────────────

describe("expenses.create — role enforcement", () => {
  it("allows coordinator to create", async () => {
    makeTwoCallChain(
      { data: { role: "coordinator" }, error: null },
      { error: null },
    );
    await expect(
      caller.expenses.create(baseCreateInput),
    ).resolves.toMatchObject({ ok: true });
  });

  it("allows caregiver to create", async () => {
    makeTwoCallChain(
      { data: { role: "caregiver" }, error: null },
      { error: null },
    );
    await expect(
      caller.expenses.create(baseCreateInput),
    ).resolves.toMatchObject({ ok: true });
  });

  it("blocks supporter from creating", async () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      single: vi
        .fn()
        .mockResolvedValue({ data: { role: "supporter" }, error: null }),
    };
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain);
    await expect(caller.expenses.create(baseCreateInput)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });
});

// ─── expenses.delete — role enforcement ───────────────────────────────────────

describe("expenses.delete — role enforcement", () => {
  it("allows coordinator to delete", async () => {
    makeTwoCallChain(
      { data: { role: "coordinator" }, error: null },
      { error: null },
    );
    await expect(
      caller.expenses.delete(baseDeleteInput),
    ).resolves.toMatchObject({ ok: true });
  });

  it("blocks caregiver from deleting", async () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      single: vi
        .fn()
        .mockResolvedValue({ data: { role: "caregiver" }, error: null }),
    };
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain);
    await expect(caller.expenses.delete(baseDeleteInput)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("blocks non-member from deleting", async () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain);
    await expect(caller.expenses.delete(baseDeleteInput)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });
});
