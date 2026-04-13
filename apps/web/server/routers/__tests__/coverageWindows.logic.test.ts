// @vitest-environment node
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
const RECIPIENT_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const WINDOW_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as Parameters<
    typeof appRouter.createCaller
  >[0]["user"],
  supabase: { from: vi.fn() } as Parameters<
    typeof appRouter.createCaller
  >[0]["supabase"],
  req: undefined,
});

function makeCoordinatorChain() {
  const chain: ReturnType<typeof makeChainBase> & {
    single: ReturnType<typeof vi.fn>;
  } = {
    select: () => chain,
    eq: () => chain,
    single: vi.fn().mockResolvedValue({
      data: { role: "coordinator", accepted_at: "2026-01-01" },
      error: null,
    }),
  } as unknown as ReturnType<typeof makeChainBase> & {
    single: ReturnType<typeof vi.fn>;
  };
  return chain;
}

function makeChainBase() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    insert: () => chain,
    delete: () => chain,
    single: vi.fn(),
  };
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

// ─── coverageWindows.list ────────────────────────────────────────────────────

describe("coverageWindows.list — logic", () => {
  it("returns empty array when no windows exist", async () => {
    const ctxSupabase = { from: vi.fn() } as Parameters<
      typeof appRouter.createCaller
    >[0]["supabase"];
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as Parameters<
        typeof appRouter.createCaller
      >[0]["user"],
      supabase: ctxSupabase,
      req: undefined,
    });
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: vi.fn().mockReturnThis(),
    } as unknown as {
      select: () => typeof chain;
      eq: () => typeof chain;
      order: ReturnType<typeof vi.fn>;
    };
    // First order() returns chain; second order() resolves
    (chain.order as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(chain)
      .mockResolvedValue({ data: null, error: null });
    vi.mocked(ctxSupabase.from).mockReturnValue(
      chain as unknown as ReturnType<typeof ctxSupabase.from>,
    );

    const result = await caller.coverageWindows.list({
      org_id: ORG_ID,
      recipient_id: RECIPIENT_ID,
    });
    expect(result).toEqual([]);
  });

  it("returns windows ordered by day_of_week", async () => {
    const windows = [
      {
        id: WINDOW_ID,
        org_id: ORG_ID,
        recipient_id: RECIPIENT_ID,
        day_of_week: 1,
      },
      {
        id: "59dc6d19-6712-4b26-8797-b4e544e01b88",
        org_id: ORG_ID,
        recipient_id: RECIPIENT_ID,
        day_of_week: 3,
      },
    ];
    const ctxSupabase = { from: vi.fn() } as Parameters<
      typeof appRouter.createCaller
    >[0]["supabase"];
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as Parameters<
        typeof appRouter.createCaller
      >[0]["user"],
      supabase: ctxSupabase,
      req: undefined,
    });
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: vi.fn().mockReturnThis(),
    } as unknown as {
      select: () => typeof chain;
      eq: () => typeof chain;
      order: ReturnType<typeof vi.fn>;
    };
    (chain.order as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(chain)
      .mockResolvedValue({ data: windows, error: null });
    vi.mocked(ctxSupabase.from).mockReturnValue(
      chain as unknown as ReturnType<typeof ctxSupabase.from>,
    );

    const result = await caller.coverageWindows.list({
      org_id: ORG_ID,
      recipient_id: RECIPIENT_ID,
    });
    expect(result).toEqual(windows);
    expect(vi.mocked(ctxSupabase.from)).toHaveBeenCalledWith(
      "coverage_windows",
    );
  });

  it("throws INTERNAL_SERVER_ERROR on supabase error", async () => {
    const ctxSupabase = { from: vi.fn() } as Parameters<
      typeof appRouter.createCaller
    >[0]["supabase"];
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as Parameters<
        typeof appRouter.createCaller
      >[0]["user"],
      supabase: ctxSupabase,
      req: undefined,
    });
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: vi.fn().mockReturnThis(),
    } as unknown as {
      select: () => typeof chain;
      eq: () => typeof chain;
      order: ReturnType<typeof vi.fn>;
    };
    (chain.order as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(chain)
      .mockResolvedValue({ data: null, error: { message: "db error" } });
    vi.mocked(ctxSupabase.from).mockReturnValue(
      chain as unknown as ReturnType<typeof ctxSupabase.from>,
    );

    await expect(
      caller.coverageWindows.list({
        org_id: ORG_ID,
        recipient_id: RECIPIENT_ID,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("rejects invalid org_id (not UUID)", async () => {
    await expect(
      authedCaller.coverageWindows.list({
        org_id: "not-a-uuid",
        recipient_id: RECIPIENT_ID,
      }),
    ).rejects.toThrow();
  });
});

// ─── coverageWindows.create ──────────────────────────────────────────────────

describe("coverageWindows.create — logic", () => {
  const validInput = {
    org_id: ORG_ID,
    recipient_id: RECIPIENT_ID,
    label: "Morning shift",
    starts_at: "08:00",
    ends_at: "16:00",
    day_of_week: 1,
    recurring: true as const,
  };

  const createdWindow = {
    id: WINDOW_ID,
    org_id: ORG_ID,
    recipient_id: RECIPIENT_ID,
    label: "Morning shift",
    day_of_week: 1,
    recurring: true,
  };

  it("creates a coverage window as coordinator", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // requireCoordinator check
        const chain = {
          select: () => chain,
          eq: () => chain,
          single: vi.fn().mockResolvedValue({
            data: { role: "coordinator", accepted_at: "2026-01-01" },
            error: null,
          }),
        };
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      // insert chain
      const chain = {
        insert: () => chain,
        select: () => chain,
        single: vi.fn().mockResolvedValue({ data: createdWindow, error: null }),
      };
      return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    const result = await authedCaller.coverageWindows.create(validInput);
    expect(result).toEqual(createdWindow);
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith(
      "coverage_windows",
    );
  });

  it("throws FORBIDDEN when user is not a coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: vi.fn().mockResolvedValue({
          data: { role: "caregiver", accepted_at: "2026-01-01" },
          error: null,
        }),
      };
      return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(
      authedCaller.coverageWindows.create(validInput),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws FORBIDDEN when membership not found", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "not found" },
        }),
      };
      return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(
      authedCaller.coverageWindows.create(validInput),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws INTERNAL_SERVER_ERROR when insert fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeCoordinatorChain() as unknown as ReturnType<
          typeof supabaseAdmin.from
        >;
      }
      const chain = {
        insert: () => chain,
        select: () => chain,
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "insert failed" },
        }),
      };
      return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(
      authedCaller.coverageWindows.create(validInput),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("rejects ends_at before starts_at (schema validation)", async () => {
    await expect(
      authedCaller.coverageWindows.create({
        ...validInput,
        starts_at: "16:00",
        ends_at: "08:00",
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid HH:MM format", async () => {
    await expect(
      authedCaller.coverageWindows.create({
        ...validInput,
        starts_at: "8:00", // missing leading zero
      }),
    ).rejects.toThrow();
  });

  it("rejects day_of_week out of range", async () => {
    await expect(
      authedCaller.coverageWindows.create({
        ...validInput,
        day_of_week: 7, // max is 6
      }),
    ).rejects.toThrow();
  });
});

// ─── coverageWindows.delete ──────────────────────────────────────────────────

describe("coverageWindows.delete — logic", () => {
  it("deletes a coverage window as coordinator", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeCoordinatorChain() as unknown as ReturnType<
          typeof supabaseAdmin.from
        >;
      }
      const chain = {
        delete: () => chain,
        eq: vi.fn(),
      } as unknown as ReturnType<typeof supabaseAdmin.from>;
      // First .eq returns chain; second .eq resolves
      (chain as unknown as { eq: ReturnType<typeof vi.fn> }).eq
        .mockReturnValueOnce(chain)
        .mockResolvedValue({ error: null });
      return chain;
    });

    const result = await authedCaller.coverageWindows.delete({
      id: WINDOW_ID,
      org_id: ORG_ID,
    });
    expect(result).toEqual({ success: true });
  });

  it("throws FORBIDDEN when user is not a coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: vi.fn().mockResolvedValue({
          data: { role: "caregiver", accepted_at: "2026-01-01" },
          error: null,
        }),
      };
      return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(
      authedCaller.coverageWindows.delete({ id: WINDOW_ID, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws INTERNAL_SERVER_ERROR when delete fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeCoordinatorChain() as unknown as ReturnType<
          typeof supabaseAdmin.from
        >;
      }
      const chain = {
        delete: () => chain,
        eq: vi.fn(),
      } as unknown as ReturnType<typeof supabaseAdmin.from>;
      (chain as unknown as { eq: ReturnType<typeof vi.fn> }).eq
        .mockReturnValueOnce(chain)
        .mockResolvedValue({ error: { message: "delete failed" } });
      return chain;
    });

    await expect(
      authedCaller.coverageWindows.delete({ id: WINDOW_ID, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("rejects non-UUID id", async () => {
    await expect(
      authedCaller.coverageWindows.delete({ id: "not-a-uuid", org_id: ORG_ID }),
    ).rejects.toThrow();
  });
});
