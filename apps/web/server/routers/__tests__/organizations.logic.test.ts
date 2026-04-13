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
  getOrganization,
  createOrganization,
  getUserOrganizations,
} from "@/server/repositories/organizationsRepository";
import { createIdentity } from "@/server/repositories/identityRepository";
import { appRouter } from "@/server/trpc/router";

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const USER_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const RECIPIENT_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as Parameters<
    typeof appRouter.createCaller
  >[0]["user"],
  supabase: { from: vi.fn() } as Parameters<
    typeof appRouter.createCaller
  >[0]["supabase"],
  req: undefined,
});

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(getOrganization).mockReset();
  vi.mocked(createOrganization).mockReset();
  vi.mocked(getUserOrganizations).mockReset();
  vi.mocked(createIdentity).mockReset();
});

// ─── organizations.list ──────────────────────────────────────────────────────

describe("organizations.list — logic", () => {
  it("returns orgs for the current user", async () => {
    const orgs = [{ id: ORG_ID, name: "Smith Family", org_type: "family" }];
    vi.mocked(getUserOrganizations).mockResolvedValue(
      orgs as Awaited<ReturnType<typeof getUserOrganizations>>,
    );

    const result = await authedCaller.organizations.list();
    expect(result).toEqual(orgs);
    expect(vi.mocked(getUserOrganizations)).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
    );
  });

  it("returns empty array when user has no orgs", async () => {
    vi.mocked(getUserOrganizations).mockResolvedValue([]);

    const result = await authedCaller.organizations.list();
    expect(result).toEqual([]);
  });
});

// ─── organizations.get ───────────────────────────────────────────────────────

describe("organizations.get — logic", () => {
  it("returns an org by id", async () => {
    const org = { id: ORG_ID, name: "Smith Family", org_type: "family" };
    vi.mocked(getOrganization).mockResolvedValue(
      org as Awaited<ReturnType<typeof getOrganization>>,
    );

    const result = await authedCaller.organizations.get({ orgId: ORG_ID });
    expect(result).toEqual(org);
    expect(vi.mocked(getOrganization)).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
    );
  });

  it("returns null when org not found", async () => {
    vi.mocked(getOrganization).mockResolvedValue(
      null as Awaited<ReturnType<typeof getOrganization>>,
    );

    const result = await authedCaller.organizations.get({ orgId: ORG_ID });
    expect(result).toBeNull();
  });

  it("rejects invalid orgId (not UUID)", async () => {
    await expect(
      authedCaller.organizations.get({ orgId: "not-a-uuid" }),
    ).rejects.toThrow();
  });
});

// ─── organizations.create ────────────────────────────────────────────────────

describe("organizations.create — logic", () => {
  const validInput = {
    orgName: "Smith Family Care",
    orgType: "family" as const,
    recipientName: "Grandma Smith",
    recipientDob: "1940-01-15",
  };

  function setupSuccessfulCreate() {
    vi.mocked(createOrganization).mockResolvedValue({
      id: ORG_ID,
      name: "Smith Family Care",
    } as Awaited<ReturnType<typeof createOrganization>>);

    vi.mocked(createIdentity).mockResolvedValue("identity-token-abc");

    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // care_recipients insert
        const chain = {
          insert: () => chain,
          select: () => chain,
          single: vi
            .fn()
            .mockResolvedValue({ data: { id: RECIPIENT_ID }, error: null }),
        };
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      // memberships insert
      const chain = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
    });
  }

  it("creates org, recipient, and coordinator membership", async () => {
    setupSuccessfulCreate();

    const result = await authedCaller.organizations.create(validInput);
    expect(result.org.id).toBe(ORG_ID);
    expect(result.recipientId).toBe(RECIPIENT_ID);
    expect(vi.mocked(createOrganization)).toHaveBeenCalledWith({
      name: "Smith Family Care",
      orgType: "family",
    });
    expect(vi.mocked(createIdentity)).toHaveBeenCalledWith({
      orgId: ORG_ID,
      fullName: "Grandma Smith",
      dob: "1940-01-15",
    });
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith("memberships");
  });

  it("uses default orgType=family when not specified", async () => {
    setupSuccessfulCreate();

    await authedCaller.organizations.create({
      orgName: "My Org",
      recipientName: "John",
    });
    expect(vi.mocked(createOrganization)).toHaveBeenCalledWith({
      name: "My Org",
      orgType: "family",
    });
  });

  it("throws when recipient creation fails", async () => {
    vi.mocked(createOrganization).mockResolvedValue({
      id: ORG_ID,
      name: "Smith Family Care",
    } as Awaited<ReturnType<typeof createOrganization>>);
    vi.mocked(createIdentity).mockResolvedValue("identity-token-abc");

    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      const chain = {
        insert: () => chain,
        select: () => chain,
        single: vi
          .fn()
          .mockResolvedValue({
            data: null,
            error: { message: "insert failed" },
          }),
      };
      return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(authedCaller.organizations.create(validInput)).rejects.toThrow(
      "Recipient creation failed",
    );
  });

  it("throws when membership creation fails", async () => {
    vi.mocked(createOrganization).mockResolvedValue({
      id: ORG_ID,
      name: "Smith Family Care",
    } as Awaited<ReturnType<typeof createOrganization>>);
    vi.mocked(createIdentity).mockResolvedValue("identity-token-abc");

    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const chain = {
          insert: () => chain,
          select: () => chain,
          single: vi
            .fn()
            .mockResolvedValue({ data: { id: RECIPIENT_ID }, error: null }),
        };
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      const chain = {
        insert: vi
          .fn()
          .mockResolvedValue({
            error: { message: "membership insert failed" },
          }),
      };
      return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(authedCaller.organizations.create(validInput)).rejects.toThrow(
      "Membership creation failed",
    );
  });

  it("rejects empty orgName", async () => {
    await expect(
      authedCaller.organizations.create({ ...validInput, orgName: "" }),
    ).rejects.toThrow();
  });

  it("rejects orgName exceeding 100 chars", async () => {
    await expect(
      authedCaller.organizations.create({
        ...validInput,
        orgName: "a".repeat(101),
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid orgType", async () => {
    await expect(
      authedCaller.organizations.create({
        ...validInput,
        orgType: "nonprofit" as Parameters<
          typeof authedCaller.organizations.create
        >[0]["orgType"],
      }),
    ).rejects.toThrow();
  });

  it("creates without recipientDob (optional field)", async () => {
    setupSuccessfulCreate();

    const result = await authedCaller.organizations.create({
      orgName: "My Org",
      recipientName: "John",
    });
    expect(result.recipientId).toBe(RECIPIENT_ID);
    expect(vi.mocked(createIdentity)).toHaveBeenCalledWith({
      orgId: ORG_ID,
      fullName: "John",
      dob: undefined,
    });
  });
});
