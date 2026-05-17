import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
  wrapAdminError: vi.fn(
    (error: { message?: string }) =>
      new Error(error.message ?? "mock wrapAdminError"),
  ),
}));
vi.mock("@/server/repositories/membershipsRepository", () => ({
  getMemberships: vi.fn(),
  createMembershipAndInvite: vi.fn().mockResolvedValue({
    membershipId: "11111111-1111-1111-1111-111111111111",
    token: "a".repeat(64),
  }),
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
const VALID_TOKEN = "a".repeat(64);

const caller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: {} as any,
  req: undefined,
});

function makeSelectChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(supabaseAdmin.rpc).mockReset();
});

// ─── memberships.invite — coordinator authorization ───────────────────────────

const inviteBase = {
  orgId: ORG_ID,
  recipientId: ORG_ID,
  role: "caregiver" as const,
  email: "new@example.com",
};

describe("memberships.invite — coordinator authorization", () => {
  it("throws FORBIDDEN when caller has no membership in org", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { message: "not found" } }),
    );
    await expect(caller.memberships.invite(inviteBase)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws FORBIDDEN when caller role is caregiver", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({
        data: { role: "caregiver", accepted_at: new Date().toISOString() },
        error: null,
      }),
    );
    await expect(caller.memberships.invite(inviteBase)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws FORBIDDEN when caller role is supporter", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({
        data: { role: "supporter", accepted_at: new Date().toISOString() },
        error: null,
      }),
    );
    await expect(caller.memberships.invite(inviteBase)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws FORBIDDEN when caller is coordinator but invite not yet accepted", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({
        data: { role: "coordinator", accepted_at: null },
        error: null,
      }),
    );
    await expect(caller.memberships.invite(inviteBase)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("succeeds and returns inviteUrl when caller is accepted coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({
        data: { role: "coordinator", accepted_at: new Date().toISOString() },
        error: null,
      }),
    );
    const result = await caller.memberships.invite(inviteBase);
    expect(result).toHaveProperty("inviteUrl");
    expect(result).toHaveProperty("membershipId");
  });
});

// ─── memberships.accept — atomic RPC error mapping ───────────────────────────

describe("memberships.accept — RPC error mapping", () => {
  it("throws FORBIDDEN when RPC returns not_found", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "not_found" },
      error: null,
    } as any);
    await expect(
      caller.memberships.accept({ token: VALID_TOKEN }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when RPC returns email_mismatch", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "email_mismatch" },
      error: null,
    } as any);
    await expect(
      caller.memberships.accept({ token: VALID_TOKEN }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws CONFLICT when RPC returns already_used", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "already_used" },
      error: null,
    } as any);
    await expect(
      caller.memberships.accept({ token: VALID_TOKEN }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws INTERNAL_SERVER_ERROR with generic message on Supabase transport error (TD-167)", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: "connection refused" },
    } as any);
    await expect(
      caller.memberships.accept({ token: VALID_TOKEN }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to accept invite",
    });
    // Raw Postgres string "connection refused" must not reach client (positive
    // assertion above already pins message === "Failed to accept invite")
    // Sentry capture invoked
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tags: { component: "memberships.accept", path: "rpc.error" },
      }),
    );
  });

  it("throws INTERNAL_SERVER_ERROR with generic message on unknown sentinel (TD-167 fallthrough)", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "quota_exceeded" },
      error: null,
    } as any);
    await expect(
      caller.memberships.accept({ token: VALID_TOKEN }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to accept invite",
    });
    // Raw sentinel code must not reach client as message (positive assertion above
    // confirms message === "Failed to accept invite"; sanity-check via captured error)
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          "Unknown invite sentinel: quota_exceeded",
        ),
      }),
      expect.objectContaining({
        tags: { component: "memberships.accept", path: "rpc.fallthrough" },
      }),
    );
  });

  it("returns { success: true } on happy path", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: true, error: null },
      error: null,
    } as any);
    const result = await caller.memberships.accept({ token: VALID_TOKEN });
    expect(result).toEqual({ success: true });
  });

  it("calls accept_invite RPC with correct params", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: true, error: null },
      error: null,
    } as any);
    await caller.memberships.accept({ token: VALID_TOKEN });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("accept_invite", {
      p_token: VALID_TOKEN,
      p_user_id: USER_ID,
      p_email: "user@example.com",
    });
  });
});

// ─── memberships.changeRole — authorization ───────────────────────────────────

const MEMBERSHIP_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";
const TARGET_MEMBERSHIP_ID = "58dc6d19-6712-4b26-8797-b4e544e01b88";

const changeRoleBase = {
  orgId: ORG_ID,
  membershipId: TARGET_MEMBERSHIP_ID,
  role: "caregiver" as const,
};

describe("memberships.changeRole — authorization", () => {
  it("throws FORBIDDEN when caller has no membership (null from supabaseAdmin)", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { message: "not found" } }),
    );
    await expect(
      caller.memberships.changeRole(changeRoleBase),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when caller is caregiver (not coordinator)", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({
        data: { role: "caregiver", accepted_at: new Date().toISOString() },
        error: null,
      }),
    );
    await expect(
      caller.memberships.changeRole(changeRoleBase),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when caller is coordinator but accepted_at is null (pending)", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({
        data: { role: "coordinator", accepted_at: null },
        error: null,
      }),
    );
    await expect(
      caller.memberships.changeRole(changeRoleBase),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when target membership belongs to a different org", async () => {
    // First call: caller lookup — accepted coordinator
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(
        makeSelectChain({
          data: { role: "coordinator", accepted_at: new Date().toISOString() },
          error: null,
        }),
      )
      // Second call: target lookup — different org
      .mockReturnValueOnce(
        makeSelectChain({
          data: {
            id: TARGET_MEMBERSHIP_ID,
            user_id: "other-user-id",
            org_id: "99999999-9999-9999-9999-999999999999",
          },
          error: null,
        }),
      );
    await expect(
      caller.memberships.changeRole(changeRoleBase),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
