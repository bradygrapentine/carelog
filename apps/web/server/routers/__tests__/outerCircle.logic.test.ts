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
const REQ_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const USER_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

function makeSelectChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
  };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeSupabaseCtx(listResult: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: vi.fn().mockResolvedValue(listResult),
  };
  return { from: vi.fn().mockReturnValue(chain) };
}

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: makeSupabaseCtx({ data: [], error: null }) as any,
  req: undefined,
});

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

const createInput = {
  org_id: ORG_ID,
  recipient_id: REC_ID,
  title: "Meals needed",
  request_type: "meal" as const,
  slots_total: 3,
};

// ─── outerCircle.create — business logic ─────────────────────────────────────

describe("outerCircle.create — business logic", () => {
  it("returns the inserted row on success", async () => {
    const newRequest = {
      id: REQ_ID,
      ...createInput,
      active: true,
      share_token: "tok-abc",
    };
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({
          data: { role: "coordinator", accepted_at: new Date().toISOString() },
          error: null,
        });
      const selectChain: any = { select: () => selectChain };
      selectChain.single = vi
        .fn()
        .mockResolvedValue({ data: newRequest, error: null });
      return { insert: vi.fn().mockReturnValue(selectChain) } as any;
    });

    const result = await authedCaller.outerCircle.create(createInput);
    expect(result).toEqual(newRequest);
  });

  it("sets created_by: ctx.user.id in the insert payload", async () => {
    const insertFn = vi.fn().mockReturnValue({
      select: () => ({
        single: vi
          .fn()
          .mockResolvedValue({ data: { id: REQ_ID }, error: null }),
      }),
    });
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({
          data: { role: "coordinator", accepted_at: new Date().toISOString() },
          error: null,
        });
      return { insert: insertFn } as any;
    });

    await authedCaller.outerCircle.create(createInput);
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: USER_ID,
        org_id: ORG_ID,
        recipient_id: REC_ID,
      }),
    );
  });

  it("throws INTERNAL_SERVER_ERROR when insert fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({
          data: { role: "coordinator", accepted_at: new Date().toISOString() },
          error: null,
        });
      const selectChain: any = { select: () => selectChain };
      selectChain.single = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "insert failed" } });
      return { insert: vi.fn().mockReturnValue(selectChain) } as any;
    });

    await expect(
      authedCaller.outerCircle.create(createInput),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── outerCircle.list — business logic ───────────────────────────────────────

describe("outerCircle.list — business logic", () => {
  const listInput = { org_id: ORG_ID, recipient_id: REC_ID };

  it("returns active requests via ctx.supabase", async () => {
    const requests = [
      {
        id: REQ_ID,
        title: "Meals needed",
        active: true,
        share_token: "tok-abc",
      },
    ];
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: makeSupabaseCtx({ data: requests, error: null }) as any,
      req: undefined,
    });

    const result = await caller.outerCircle.list(listInput);
    expect(result).toEqual(requests);
  });

  it("returns empty array when no requests exist", async () => {
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: makeSupabaseCtx({ data: null, error: null }) as any,
      req: undefined,
    });

    const result = await caller.outerCircle.list(listInput);
    expect(result).toEqual([]);
  });

  it("throws INTERNAL_SERVER_ERROR when ctx.supabase read fails", async () => {
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: makeSupabaseCtx({
        data: null,
        error: { message: "db error" },
      }) as any,
      req: undefined,
    });

    await expect(caller.outerCircle.list(listInput)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});

// ─── outerCircle.deactivate — business logic ─────────────────────────────────

describe("outerCircle.deactivate — business logic", () => {
  const deactivateInput = { id: REQ_ID, org_id: ORG_ID };

  it("returns the updated row with active: false", async () => {
    const deactivated = { id: REQ_ID, active: false };
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({
          data: { role: "coordinator", accepted_at: new Date().toISOString() },
          error: null,
        });
      const chain: any = {
        update: () => chain,
        eq: () => chain,
        select: () => chain,
      };
      chain.single = vi
        .fn()
        .mockResolvedValue({ data: deactivated, error: null });
      return chain;
    });

    const result = await authedCaller.outerCircle.deactivate(deactivateInput);
    expect(result).toEqual(deactivated);
  });

  it("throws INTERNAL_SERVER_ERROR when update fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({
          data: { role: "coordinator", accepted_at: new Date().toISOString() },
          error: null,
        });
      const chain: any = {
        update: () => chain,
        eq: () => chain,
        select: () => chain,
      };
      chain.single = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "update failed" } });
      return chain;
    });

    await expect(
      authedCaller.outerCircle.deactivate(deactivateInput),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
