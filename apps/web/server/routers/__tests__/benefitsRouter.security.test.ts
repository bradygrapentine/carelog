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
const REC_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const USER_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

const anonCaller = appRouter.createCaller({
  user: null,
  supabase: {} as any,
  req: undefined,
});

function makeSelectChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain, not: () => chain };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

const screenInput = {
  org_id: ORG_ID,
  recipient_id: REC_ID,
  answers: {
    age65plus: true,
    veteran: false,
    lowIncome: true,
    medicareEnrolled: false,
    medicaidEnrolled: false,
  },
  results: [
    {
      key: "snap",
      name: "SNAP",
      description: "Food assistance",
      applyUrl: "https://snap.gov",
    },
  ],
};

// ─── benefits.screen — authorization ─────────────────────────────────────────

describe("benefits.screen — authorization", () => {
  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(anonCaller.benefits.screen(screenInput)).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });

  it("throws FORBIDDEN when caller is caregiver", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: "caregiver" }, error: null }),
    );
    await expect(
      authedCaller.benefits.screen(screenInput),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when coordinator invite not yet accepted (membership null)", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { code: "PGRST116" } }),
    );
    await expect(
      authedCaller.benefits.screen(screenInput),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ─── benefits.latest — authorization ─────────────────────────────────────────

describe("benefits.latest — authorization", () => {
  const latestInput = { org_id: ORG_ID, recipient_id: REC_ID };

  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(anonCaller.benefits.latest(latestInput)).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });

  it("throws FORBIDDEN when caller is supporter role", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: "supporter" }, error: null }),
    );
    await expect(
      authedCaller.benefits.latest(latestInput),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
