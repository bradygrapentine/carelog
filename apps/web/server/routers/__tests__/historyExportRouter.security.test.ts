/**
 * Security tests for historyExport router.
 *
 * Coverage goals:
 * - Unauthenticated callers get UNAUTHORIZED
 * - Non-coordinator role gets FORBIDDEN
 * - Coordinator can call preview and generate
 */

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

const ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const REC_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const anonCaller = appRouter.createCaller({
  user: null as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

function makeSelectChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

const exportInput = { org_id: ORG_ID, recipient_id: REC_ID };

describe("historyExport security", () => {
  describe("preview", () => {
    it("requires authentication", async () => {
      await expect(
        anonCaller.historyExport.preview(exportInput),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("forbids non-coordinator role (aide)", async () => {
      vi.mocked(supabaseAdmin.from).mockImplementation(
        () => makeSelectChain({ data: { role: "aide" }, error: null }) as any,
      );
      await expect(
        authedCaller.historyExport.preview(exportInput),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("forbids when membership not found", async () => {
      vi.mocked(supabaseAdmin.from).mockImplementation(
        () =>
          makeSelectChain({
            data: null,
            error: { message: "not found" },
          }) as any,
      );
      await expect(
        authedCaller.historyExport.preview(exportInput),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("generate", () => {
    it("requires authentication", async () => {
      await expect(
        anonCaller.historyExport.generate(exportInput),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("forbids non-coordinator role (supporter)", async () => {
      vi.mocked(supabaseAdmin.from).mockImplementation(
        () =>
          makeSelectChain({
            data: { role: "supporter" },
            error: null,
          }) as any,
      );
      await expect(
        authedCaller.historyExport.generate(exportInput),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
