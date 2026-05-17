import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/server/repositories/careEventsRepository", () => ({
  getTimeline: vi.fn(),
  insertEvent: vi.fn(),
  getFlaggedEvents: vi.fn(),
  insertEventIdempotent: vi.fn(),
}));
vi.mock("@/server/repositories/membershipsRepository", () => ({
  getMemberships: vi.fn(),
  createMembershipAndInvite: vi.fn().mockResolvedValue({
    membershipId: "11111111-1111-1111-1111-111111111111",
    token: "a".repeat(64),
  }),
}));
vi.mock("@/server/repositories/organizationsRepository", () => ({
  getOrganization: vi.fn(),
  createOrganization: vi.fn(),
  getUserOrganizations: vi.fn(),
}));
vi.mock("@/server/repositories/identityRepository", () => ({
  createIdentity: vi.fn(),
}));

import { appRouter } from "@/server/trpc/router";

const VALID_UUID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const VALID_TOKEN = "a".repeat(64);

const authCtx = {
  user: { id: VALID_UUID, email: "test@test.com" } as any,
  supabase: {} as any,
  req: undefined,
};

const anonCtx = {
  user: null,
  supabase: {} as any,
  req: undefined,
};

const caller = appRouter.createCaller(authCtx);
const anonCaller = appRouter.createCaller(anonCtx);

describe("protectedProcedure — unauthorized", () => {
  it("rejects unauthenticated calls to careEvents.timeline", async () => {
    await expect(
      anonCaller.careEvents.timeline({ recipientId: VALID_UUID }),
    ).rejects.toThrow();
  });

  it("rejects unauthenticated calls to memberships.list", async () => {
    await expect(
      anonCaller.memberships.list({ orgId: VALID_UUID }),
    ).rejects.toThrow();
  });
});

describe("careEvents.timeline input validation", () => {
  it("rejects a non-uuid recipientId", async () => {
    await expect(
      caller.careEvents.timeline({ recipientId: "not-a-uuid" }),
    ).rejects.toThrow();
  });

  it("rejects limit = 0 (below minimum)", async () => {
    await expect(
      caller.careEvents.timeline({ recipientId: VALID_UUID, limit: 0 }),
    ).rejects.toThrow();
  });

  it("rejects limit = 101 (above maximum)", async () => {
    await expect(
      caller.careEvents.timeline({ recipientId: VALID_UUID, limit: 101 }),
    ).rejects.toThrow();
  });
});

describe("careEvents.flagged input validation", () => {
  it("rejects a non-uuid recipientId", async () => {
    await expect(
      caller.careEvents.flagged({ recipientId: "bad" }),
    ).rejects.toThrow();
  });
});

describe("memberships.invite input validation", () => {
  const base = {
    orgId: VALID_UUID,
    recipientId: VALID_UUID,
    role: "caregiver" as const,
    email: "valid@example.com",
  };

  it("rejects a non-uuid orgId", async () => {
    await expect(
      caller.memberships.invite({ ...base, orgId: "bad" }),
    ).rejects.toThrow();
  });

  it("rejects an invalid email", async () => {
    await expect(
      caller.memberships.invite({ ...base, email: "not-an-email" }),
    ).rejects.toThrow();
  });

  it("rejects an invalid role", async () => {
    await expect(
      caller.memberships.invite({ ...base, role: "admin" as any }),
    ).rejects.toThrow();
  });
});

describe("memberships.accept input validation", () => {
  it("rejects a token that is too short", async () => {
    await expect(
      caller.memberships.accept({ token: "short" }),
    ).rejects.toThrow();
  });

  it("rejects a token that is too long", async () => {
    await expect(
      caller.memberships.accept({ token: "a".repeat(65) }),
    ).rejects.toThrow();
  });
});

describe("organizations.get input validation", () => {
  it("rejects a non-uuid orgId", async () => {
    await expect(caller.organizations.get({ orgId: "bad" })).rejects.toThrow();
  });
});

describe("organizations.create input validation", () => {
  it("rejects empty orgName", async () => {
    await expect(
      caller.organizations.create({
        orgName: "",
        recipientName: "Test Person",
      }),
    ).rejects.toThrow();
  });

  it("rejects orgName over 100 characters", async () => {
    await expect(
      caller.organizations.create({
        orgName: "a".repeat(101),
        recipientName: "Test Person",
      }),
    ).rejects.toThrow();
  });

  it("rejects empty recipientName", async () => {
    await expect(
      caller.organizations.create({
        orgName: "Test Org",
        recipientName: "",
      }),
    ).rejects.toThrow();
  });
});
