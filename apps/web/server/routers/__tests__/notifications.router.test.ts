import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { appRouter } from "@/server/trpc/router";
import { TRPCError } from "@trpc/server";

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

const anonCaller = appRouter.createCaller({
  user: null as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

function makeUpsertChain(result: object) {
  const chain: any = {
    upsert: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

describe("notifications.registerToken", () => {
  it("saves a new push token successfully", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeUpsertChain({ data: [{ id: "1" }], error: null }),
    );

    const result = await authedCaller.notifications.registerToken({
      token: "ExponentPushToken[abc123]",
      platform: "android",
    });

    expect(result).toEqual({ success: true });
    expect(supabaseAdmin.from).toHaveBeenCalledWith("push_tokens");
  });

  it("is idempotent — duplicate token still returns success", async () => {
    // On conflict upsert returns no error (Postgres upsert no-ops)
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeUpsertChain({ data: [], error: null }),
    );

    const result = await authedCaller.notifications.registerToken({
      token: "ExponentPushToken[duplicate]",
      platform: "ios",
    });

    expect(result).toEqual({ success: true });
  });

  it("returns UNAUTHORIZED if not authenticated", async () => {
    await expect(
      anonCaller.notifications.registerToken({
        token: "ExponentPushToken[abc123]",
        platform: "android",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
