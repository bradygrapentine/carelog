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
import {
  getMemberships,
  createMembershipAndInvite,
} from "@/server/repositories/membershipsRepository";
import { appRouter } from "@/server/trpc/router";
import type { Context } from "@/server/trpc";

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const USER_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const RECIPIENT_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const MEMBERSHIP_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

const VALID_TOKEN = "a".repeat(64);

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as Context["user"],
  supabase: { from: vi.fn() } as unknown as Context["supabase"],
  req: undefined,
});

function makeCoordinatorChain() {
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

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(supabaseAdmin.rpc).mockReset();
  vi.mocked(getMemberships).mockReset();
  vi.mocked(createMembershipAndInvite).mockReset();
});

// ─── memberships.list ────────────────────────────────────────────────────────

describe("memberships.list — logic", () => {
  it("returns memberships for an org", async () => {
    const memberships = [
      {
        id: MEMBERSHIP_ID,
        org_id: ORG_ID,
        user_id: USER_ID,
        role: "coordinator",
      },
    ];
    vi.mocked(getMemberships).mockResolvedValue(
      memberships as Awaited<ReturnType<typeof getMemberships>>,
    );

    const result = await authedCaller.memberships.list({ orgId: ORG_ID });
    expect(result).toEqual(memberships);
    expect(vi.mocked(getMemberships)).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      undefined,
    );
  });

  it("returns empty array when no memberships exist", async () => {
    vi.mocked(getMemberships).mockResolvedValue([]);

    const result = await authedCaller.memberships.list({ orgId: ORG_ID });
    expect(result).toEqual([]);
  });

  it("filters by recipientId when provided", async () => {
    vi.mocked(getMemberships).mockResolvedValue([]);

    await authedCaller.memberships.list({
      orgId: ORG_ID,
      recipientId: RECIPIENT_ID,
    });
    expect(vi.mocked(getMemberships)).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      RECIPIENT_ID,
    );
  });

  it("rejects invalid orgId (not UUID)", async () => {
    await expect(
      authedCaller.memberships.list({ orgId: "not-a-uuid" }),
    ).rejects.toThrow();
  });
});

// ─── memberships.invite ──────────────────────────────────────────────────────

describe("memberships.invite — logic", () => {
  const validInput = {
    orgId: ORG_ID,
    recipientId: RECIPIENT_ID,
    role: "caregiver" as const,
    email: "newmember@example.com",
  };

  it("creates invite as coordinator and returns membershipId + inviteUrl", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeCoordinatorChain());
    vi.mocked(createMembershipAndInvite).mockResolvedValue({
      membershipId: MEMBERSHIP_ID,
      token: "tok123",
    });

    const result = await authedCaller.memberships.invite(validInput);
    expect(result.membershipId).toBe(MEMBERSHIP_ID);
    expect(result.inviteUrl).toContain("/invite/tok123");
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
      authedCaller.memberships.invite(validInput),
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
      authedCaller.memberships.invite(validInput),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws FORBIDDEN when membership has no accepted_at", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: vi.fn().mockResolvedValue({
          data: { role: "coordinator", accepted_at: null },
          error: null,
        }),
      };
      return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(
      authedCaller.memberships.invite(validInput),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects invalid email", async () => {
    await expect(
      authedCaller.memberships.invite({ ...validInput, email: "not-an-email" }),
    ).rejects.toThrow();
  });

  it("rejects invalid role", async () => {
    await expect(
      authedCaller.memberships.invite({
        ...validInput,
        role: "unknown" as Parameters<
          typeof authedCaller.memberships.invite
        >[0]["role"],
      }),
    ).rejects.toThrow();
  });

  it("accepts null recipientId", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeCoordinatorChain());
    vi.mocked(createMembershipAndInvite).mockResolvedValue({
      membershipId: MEMBERSHIP_ID,
      token: "tok456",
    });

    const result = await authedCaller.memberships.invite({
      ...validInput,
      recipientId: null,
    });
    expect(result.membershipId).toBe(MEMBERSHIP_ID);
  });
});

// ─── memberships.accept ──────────────────────────────────────────────────────

describe("memberships.accept — logic", () => {
  it("accepts a valid invite token", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: true },
      error: null,
    } as Awaited<ReturnType<typeof supabaseAdmin.rpc>>);

    const result = await authedCaller.memberships.accept({
      token: VALID_TOKEN,
    });
    expect(result).toEqual({ success: true });
    expect(vi.mocked(supabaseAdmin.rpc)).toHaveBeenCalledWith("accept_invite", {
      p_token: VALID_TOKEN,
      p_user_id: USER_ID,
      p_email: "user@example.com",
    });
  });

  it("throws INTERNAL_SERVER_ERROR on rpc error", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: "rpc failed" },
    } as Awaited<ReturnType<typeof supabaseAdmin.rpc>>);

    await expect(
      authedCaller.memberships.accept({ token: VALID_TOKEN }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("throws FORBIDDEN when invite not found", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "not_found" },
      error: null,
    } as Awaited<ReturnType<typeof supabaseAdmin.rpc>>);

    await expect(
      authedCaller.memberships.accept({ token: VALID_TOKEN }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when email mismatches", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "email_mismatch" },
      error: null,
    } as Awaited<ReturnType<typeof supabaseAdmin.rpc>>);

    await expect(
      authedCaller.memberships.accept({ token: VALID_TOKEN }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws CONFLICT when invite already used", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "already_used" },
      error: null,
    } as Awaited<ReturnType<typeof supabaseAdmin.rpc>>);

    await expect(
      authedCaller.memberships.accept({ token: VALID_TOKEN }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws INTERNAL_SERVER_ERROR on unknown rpc error", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "something_weird" },
      error: null,
    } as Awaited<ReturnType<typeof supabaseAdmin.rpc>>);

    await expect(
      authedCaller.memberships.accept({ token: VALID_TOKEN }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("rejects token shorter than 64 chars", async () => {
    await expect(
      authedCaller.memberships.accept({ token: "tooshort" }),
    ).rejects.toThrow();
  });

  it("rejects token longer than 64 chars", async () => {
    await expect(
      authedCaller.memberships.accept({ token: "a".repeat(65) }),
    ).rejects.toThrow();
  });
});

describe("memberships.remove — logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TARGET_MEMBERSHIP_ID = "58dc6d19-6712-4b26-8797-b4e544e01b88";
  const TARGET_USER_ID = "68dc6d19-6712-4b26-8797-b4e544e01b89";

  function mockCaller(role: string, acceptedAt: string | null = "2024-01-01") {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role, accepted_at: acceptedAt },
        error: null,
      }),
    };
  }

  function mockTarget(
    role: string,
    orgId: string,
    userId: string = TARGET_USER_ID,
  ) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: TARGET_MEMBERSHIP_ID,
          user_id: userId,
          role,
          org_id: orgId,
        },
        error: null,
      }),
    };
  }

  function mockCount(count: number) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ count, error: null }),
    };
  }

  function mockDelete() {
    return {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
  }

  it("coordinator removes a caregiver", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        mockCaller("coordinator") as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        mockTarget("caregiver", ORG_ID) as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        mockDelete() as unknown as ReturnType<typeof supabaseAdmin.from>,
      );

    const result = await authedCaller.memberships.remove({
      orgId: ORG_ID,
      membershipId: TARGET_MEMBERSHIP_ID,
    });

    expect(result).toEqual({ removed: true });
  });

  it("non-coordinator is rejected with FORBIDDEN", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      mockCaller("caregiver") as unknown as ReturnType<
        typeof supabaseAdmin.from
      >,
    );

    await expect(
      authedCaller.memberships.remove({
        orgId: ORG_ID,
        membershipId: TARGET_MEMBERSHIP_ID,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cross-org target rejected with FORBIDDEN", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        mockCaller("coordinator") as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        mockTarget(
          "caregiver",
          "99999999-9999-9999-9999-999999999999",
        ) as unknown as ReturnType<typeof supabaseAdmin.from>,
      );

    await expect(
      authedCaller.memberships.remove({
        orgId: ORG_ID,
        membershipId: TARGET_MEMBERSHIP_ID,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("removing self rejected with BAD_REQUEST", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        mockCaller("coordinator") as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        mockTarget("coordinator", ORG_ID, USER_ID) as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      );

    await expect(
      authedCaller.memberships.remove({
        orgId: ORG_ID,
        membershipId: TARGET_MEMBERSHIP_ID,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("removing last coordinator rejected with BAD_REQUEST", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        mockCaller("coordinator") as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        mockTarget("coordinator", ORG_ID) as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        mockCount(1) as unknown as ReturnType<typeof supabaseAdmin.from>,
      );

    await expect(
      authedCaller.memberships.remove({
        orgId: ORG_ID,
        membershipId: TARGET_MEMBERSHIP_ID,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("removing a coordinator succeeds when other coordinators remain", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        mockCaller("coordinator") as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        mockTarget("coordinator", ORG_ID) as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        mockCount(2) as unknown as ReturnType<typeof supabaseAdmin.from>,
      )
      .mockReturnValueOnce(
        mockDelete() as unknown as ReturnType<typeof supabaseAdmin.from>,
      );

    const result = await authedCaller.memberships.remove({
      orgId: ORG_ID,
      membershipId: TARGET_MEMBERSHIP_ID,
    });

    expect(result).toEqual({ removed: true });
  });
});

// ─── memberships.changeRole — logic ──────────────────────────────────────────

describe("memberships.changeRole — logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TARGET_MEMBERSHIP_ID = "58dc6d19-6712-4b26-8797-b4e544e01b88";
  const TARGET_USER_ID = "68dc6d19-6712-4b26-8797-b4e544e01b89";

  function mockCaller(role: string, acceptedAt: string | null = "2024-01-01") {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role, accepted_at: acceptedAt },
        error: null,
      }),
    };
  }

  function mockTarget(orgId: string, userId: string = TARGET_USER_ID) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: TARGET_MEMBERSHIP_ID,
          user_id: userId,
          org_id: orgId,
        },
        error: null,
      }),
    };
  }

  function mockUpdate() {
    const chain: {
      update: () => typeof chain;
      eq: () => Promise<{ error: null }>;
    } = {
      update: () => chain,
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    return chain;
  }

  it("happy path: coordinator changes another member's role", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        mockCaller("coordinator") as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        mockTarget(ORG_ID) as unknown as ReturnType<typeof supabaseAdmin.from>,
      )
      .mockReturnValueOnce(
        mockUpdate() as unknown as ReturnType<typeof supabaseAdmin.from>,
      );

    const result = await authedCaller.memberships.changeRole({
      orgId: ORG_ID,
      membershipId: TARGET_MEMBERSHIP_ID,
      role: "caregiver",
    });

    expect(result).toEqual({ updated: true });
  });

  it("throws BAD_REQUEST when caller tries to change own role", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        mockCaller("coordinator") as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        mockTarget(ORG_ID, USER_ID) as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      );

    await expect(
      authedCaller.memberships.changeRole({
        orgId: ORG_ID,
        membershipId: TARGET_MEMBERSHIP_ID,
        role: "caregiver",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws Zod validation error for invalid role", async () => {
    await expect(
      authedCaller.memberships.changeRole({
        orgId: ORG_ID,
        membershipId: TARGET_MEMBERSHIP_ID,
        role: "superadmin" as Parameters<
          typeof authedCaller.memberships.changeRole
        >[0]["role"],
      }),
    ).rejects.toThrow();
  });

  it("throws Zod validation error for invalid orgId", async () => {
    await expect(
      authedCaller.memberships.changeRole({
        orgId: "not-a-uuid",
        membershipId: TARGET_MEMBERSHIP_ID,
        role: "caregiver",
      }),
    ).rejects.toThrow();
  });

  it("throws Zod validation error for invalid membershipId", async () => {
    await expect(
      authedCaller.memberships.changeRole({
        orgId: ORG_ID,
        membershipId: "not-a-uuid",
        role: "caregiver",
      }),
    ).rejects.toThrow();
  });

  it("throws NOT_FOUND when target membership does not exist", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        mockCaller("coordinator") as unknown as ReturnType<
          typeof supabaseAdmin.from
        >,
      )
      .mockReturnValueOnce(
        (() => {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "not found" },
            }),
          };
          return chain;
        })() as unknown as ReturnType<typeof supabaseAdmin.from>,
      );

    await expect(
      authedCaller.memberships.changeRole({
        orgId: ORG_ID,
        membershipId: TARGET_MEMBERSHIP_ID,
        role: "caregiver",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
