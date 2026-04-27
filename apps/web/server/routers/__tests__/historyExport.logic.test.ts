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

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const REC_ID = "33333333-3333-3333-3333-333333333333";

const coordinatorCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "coord@example.com" } as any,
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

function setupCoordinatorMembership() {
  vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
    if (table === "memberships") {
      return makeSelectChain({
        data: { role: "coordinator" },
        error: null,
      }) as any;
    }
    if (table === "care_recipients") {
      return makeSelectChain({
        data: { identity_token: "tok-abc" },
        error: null,
      }) as any;
    }
    if (table === "identity_vault") {
      return makeSelectChain({
        data: { full_name: "Jane Doe", dob: "1940-01-01" },
        error: null,
      }) as any;
    }
    if (table === "eol_plans") {
      return makeSelectChain({ data: null, error: null }) as any;
    }
    // Default: empty arrays for care_events, medications, symptom_readings, documents
    const emptyChain: any = {
      select: () => emptyChain,
      eq: () => emptyChain,
      not: () => emptyChain,
      order: () => emptyChain,
      single: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    // For tables that return arrays we resolve directly (no .single())
    return {
      ...emptyChain,
      then: undefined,
      // simulate Supabase builder resolving to { data: [], error: null }
      _resolved: Promise.resolve({ data: [], error: null }),
    } as any;
  });
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

describe("historyExport.preview", () => {
  it("returns counts when coordinator", async () => {
    setupCoordinatorMembership();

    // Override care_events to return items
    const originalFrom = vi.mocked(supabaseAdmin.from);
    originalFrom.mockImplementation((table: string) => {
      if (table === "memberships") {
        return makeSelectChain({
          data: { role: "coordinator" },
          error: null,
        }) as any;
      }
      if (table === "care_recipients") {
        return makeSelectChain({
          data: { identity_token: "tok-abc" },
          error: null,
        }) as any;
      }
      if (table === "identity_vault") {
        return makeSelectChain({
          data: { full_name: "Jane Doe", dob: null },
          error: null,
        }) as any;
      }
      if (table === "eol_plans") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          not: () => chain,
          order: () => chain,
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        return chain;
      }
      // care_events, medications, symptom_readings, documents
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        not: () => chain,
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      return chain;
    });

    const result = await coordinatorCaller.historyExport.preview({
      org_id: ORG_ID,
      recipient_id: REC_ID,
    });

    expect(typeof result.care_events).toBe("number");
    expect(typeof result.medications).toBe("number");
    expect(typeof result.symptom_readings).toBe("number");
    expect(typeof result.eol_plan).toBe("boolean");
    expect(typeof result.documents_metadata).toBe("number");
  });
});

describe("historyExport.generate", () => {
  it("returns snapshot with recipient_name when coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "memberships") {
        return makeSelectChain({
          data: { role: "coordinator" },
          error: null,
        }) as any;
      }
      if (table === "care_recipients") {
        return makeSelectChain({
          data: { identity_token: "tok-abc" },
          error: null,
        }) as any;
      }
      if (table === "identity_vault") {
        return makeSelectChain({
          data: { full_name: "Jane Doe", dob: "1940-01-01" },
          error: null,
        }) as any;
      }
      if (table === "eol_plans") {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          not: () => chain,
          order: () => chain,
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        return chain;
      }
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        not: () => chain,
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      return chain;
    });

    const result = await coordinatorCaller.historyExport.generate({
      org_id: ORG_ID,
      recipient_id: REC_ID,
    });

    expect(result.snapshot.recipient_name).toBe("Jane Doe");
    expect(result.snapshot.recipient_id).toBe(REC_ID);
    expect(result.snapshot.generated_at).toBeTruthy();
  });
});
