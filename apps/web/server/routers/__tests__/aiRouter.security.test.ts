/**
 * Security tests for apps/web/server/routers/ai.ts
 *
 * Coverage goals:
 * - All three procedures require authentication
 * - query enforces consent before hitting Anthropic (no API call without consent)
 * - revokeConsent deletes ai_conversations scoped to authenticated user only
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── mocks ───────────────────────────────────────────────────────────────────

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
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

vi.mock("@/lib/ai-deidentify", () => ({
  deidentifyText: vi.fn((t: string) => t),
  buildNameMap: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/ai-context", () => ({
  formatContextBlob: vi.fn().mockReturnValue("ctx"),
}));

const mockAnthropicCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  const Ctor = function (this: unknown) {
    (this as any).messages = {
      create: (...args: unknown[]) => mockAnthropicCreate(...args),
    };
  };
  return { default: Ctor };
});

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { appRouter } from "@/server/trpc/router";

// ── fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const USER_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";

const anonCaller = appRouter.createCaller({
  user: null,
  supabase: {} as any,
  req: undefined,
});

function makeSelectChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    lte: () => chain,
    not: () => chain,
    order: () => chain,
    contains: () => chain,
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
  };
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  mockAnthropicCreate.mockReset();
});

// ── authentication guard ───────────────────────────────────────────────────────

describe("ai router — authentication guard", () => {
  it("ai.query throws UNAUTHORIZED for anonymous caller", async () => {
    await expect(
      anonCaller.ai.query({
        prompt: "test",
        pageContext: "dashboard",
        orgId: ORG_ID,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("ai.enableConsent throws UNAUTHORIZED for anonymous caller", async () => {
    await expect(anonCaller.ai.enableConsent()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("ai.revokeConsent throws UNAUTHORIZED for anonymous caller", async () => {
    await expect(anonCaller.ai.revokeConsent()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ── consent gate blocks Anthropic API call ─────────────────────────────────────

describe("ai.query — consent blocks Anthropic call", () => {
  it("does NOT call Anthropic when consent is disabled", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { ai_assistant_enabled: false }, error: null }),
    );

    const authedCaller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: { from: vi.fn() } as any,
      req: undefined,
    });

    await expect(
      authedCaller.ai.query({
        prompt: "test",
        pageContext: "dashboard",
        orgId: ORG_ID,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it("does NOT call Anthropic when profile fetch errors", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { message: "db error" } }),
    );

    const authedCaller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: { from: vi.fn() } as any,
      req: undefined,
    });

    await expect(
      authedCaller.ai.query({
        prompt: "test",
        pageContext: "dashboard",
        orgId: ORG_ID,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });
});

// ── revokeConsent data deletion ────────────────────────────────────────────────

describe("ai.revokeConsent — data cleanup", () => {
  it("deletes ai_conversations scoped to authenticated user on revoke", async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });

    const ctxSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_profiles") {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return { delete: deleteMock, eq: eqMock };
      }),
    };

    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase as any,
      req: undefined,
    });

    await caller.ai.revokeConsent();

    expect(eqMock).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
