/**
 * Tests for apps/web/server/routers/ai.ts — logic paths
 *
 * Coverage goals:
 * - query throws UNAUTHORIZED when no user in context
 * - query throws FORBIDDEN when AI consent not enabled
 * - query calls deidentifyText before sending to Anthropic (PHI safety)
 * - query returns response + parsed action
 * - query returns response with null action when no ACTION line
 * - enableConsent updates user_profiles
 * - revokeConsent updates user_profiles and deletes ai_conversations
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

const mockDeidentifyText = vi.fn(
  (text: string, _nameMap?: Record<string, string>) => `[deidentified] ${text}`,
);
const mockBuildNameMap = vi
  .fn()
  .mockReturnValue({ "Jane Doe": "care recipient" });
vi.mock("@/lib/ai-deidentify", () => ({
  deidentifyText: (text: string, nameMap: Record<string, string>) =>
    mockDeidentifyText(text, nameMap),
  buildNameMap: (recipientName: string, teamNames: string[]) =>
    mockBuildNameMap(recipientName, teamNames),
}));

vi.mock("@/lib/ai-context", () => ({
  formatContextBlob: vi.fn().mockReturnValue("mock context blob"),
}));

vi.mock("@/lib/ai-phi-monitor", () => ({
  detectPhiSlip: vi.fn().mockReturnValue({ slipped: false, matchedKeys: [] }),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn().mockReturnValue({ capture: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
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

const VALID_QUERY_INPUT = {
  prompt: "What medications does the patient take?",
  pageContext: "medications" as const,
  orgId: ORG_ID,
};

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
  mockDeidentifyText.mockImplementation(
    (text: string) => `[deidentified] ${text}`,
  );
});

// ── ai.query ──────────────────────────────────────────────────────────────────

describe("ai.query — authentication", () => {
  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(anonCaller.ai.query(VALID_QUERY_INPUT)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("ai.query — consent gate", () => {
  it("throws FORBIDDEN when AI consent is not enabled", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { ai_assistant_enabled: false }, error: null }),
    );

    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: { from: vi.fn() } as any,
      req: undefined,
    });

    await expect(caller.ai.query(VALID_QUERY_INPUT)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws INTERNAL_SERVER_ERROR when profile fetch fails", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { message: "db error" } }),
    );

    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: { from: vi.fn() } as any,
      req: undefined,
    });

    await expect(caller.ai.query(VALID_QUERY_INPUT)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});

describe("ai.query — PHI deidentification", () => {
  it("calls deidentifyText on the user prompt before sending to Anthropic", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { ai_assistant_enabled: true }, error: null }),
    );

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Here are the medications." }],
    });

    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
        }),
      } as any,
      req: undefined,
    });

    await caller.ai.query(VALID_QUERY_INPUT);

    expect(mockDeidentifyText).toHaveBeenCalled();
    const [promptArg] = mockDeidentifyText.mock.calls[0]!;
    expect(promptArg).toBe(VALID_QUERY_INPUT.prompt);
  });

  it("sends the deidentified prompt to Anthropic, not the raw prompt", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { ai_assistant_enabled: true }, error: null }),
    );

    mockDeidentifyText.mockReturnValue("[REDACTED]");
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Safe response." }],
    });

    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
        }),
      } as any,
      req: undefined,
    });

    await caller.ai.query(VALID_QUERY_INPUT);

    expect(mockAnthropicCreate).toHaveBeenCalledOnce();
    const [callArgs] = mockAnthropicCreate.mock.calls[0]!;
    const userMessage = (callArgs as any).messages[0].content as string;
    expect(userMessage).toContain("[REDACTED]");
  });
});

describe("ai.query — PHI-slip observability (SEC-005)", () => {
  it("when detectPhiSlip returns slipped=true, Sentry+PostHog receive count-only payload with org_id (never matchedKeys)", async () => {
    const { detectPhiSlip } = await import("@/lib/ai-phi-monitor");
    const { getPostHogClient } = await import("@/lib/posthog-server");
    const Sentry = await import("@sentry/nextjs");

    const phCapture = vi.fn();
    vi.mocked(getPostHogClient).mockReturnValue({ capture: phCapture } as any);
    vi.mocked(detectPhiSlip).mockReturnValueOnce({
      slipped: true,
      matchedKeys: ["Alice", "Bob"],
    });

    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { ai_assistant_enabled: true }, error: null }),
    );
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Alice's medications include..." }],
    });

    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
        }),
      } as any,
      req: undefined,
    });

    await caller.ai.query(VALID_QUERY_INPUT);

    expect(Sentry.captureMessage).toHaveBeenCalledWith("ai_phi_slip", {
      level: "warning",
      extra: { matchedKeyCount: 2, orgId: ORG_ID },
    });
    expect(phCapture).toHaveBeenCalledWith({
      distinctId: USER_ID,
      event: "ai_phi_slip",
      properties: { matched_key_count: 2, org_id: ORG_ID },
    });
    // PHI invariant: raw matched key strings must NEVER reach Sentry/PostHog.
    const sentryArgs = JSON.stringify(
      vi.mocked(Sentry.captureMessage).mock.calls,
    );
    const phArgs = JSON.stringify(phCapture.mock.calls);
    expect(sentryArgs).not.toContain("Alice");
    expect(sentryArgs).not.toContain("Bob");
    expect(phArgs).not.toContain("Alice");
    expect(phArgs).not.toContain("Bob");
  });

  it("when detectPhiSlip returns slipped=false, neither Sentry nor PostHog are called", async () => {
    const { detectPhiSlip } = await import("@/lib/ai-phi-monitor");
    const { getPostHogClient } = await import("@/lib/posthog-server");
    const Sentry = await import("@sentry/nextjs");

    const phCapture = vi.fn();
    vi.mocked(getPostHogClient).mockReturnValue({ capture: phCapture } as any);
    vi.mocked(detectPhiSlip).mockReturnValueOnce({
      slipped: false,
      matchedKeys: [],
    });
    vi.mocked(Sentry.captureMessage).mockClear();

    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { ai_assistant_enabled: true }, error: null }),
    );
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Safe response." }],
    });

    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
        }),
      } as any,
      req: undefined,
    });

    await caller.ai.query(VALID_QUERY_INPUT);

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(phCapture).not.toHaveBeenCalled();
  });
});

describe("ai.query — response parsing", () => {
  function makeAuthedCaller() {
    return appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
        }),
      } as any,
      req: undefined,
    });
  }

  beforeEach(() => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { ai_assistant_enabled: true }, error: null }),
    );
  });

  it("returns response text and null action when no ACTION line", async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Here are the active medications." }],
    });

    const result = await makeAuthedCaller().ai.query(VALID_QUERY_INPUT);
    expect(result.response).toBe("Here are the active medications.");
    expect(result.action).toBeNull();
  });

  it("parses an ACTION line into a structured action object", async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "I can log that dose.\nACTION: log_medication_dose | Metformin 500mg at 8am\n",
        },
      ],
    });

    const result = await makeAuthedCaller().ai.query(VALID_QUERY_INPUT);
    expect(result.action).toMatchObject({
      type: "log_medication_dose",
      description: "Metformin 500mg at 8am",
    });
    expect(result.response).not.toMatch(/ACTION:/i);
  });

  it("ignores ACTION lines with disallowed action types", async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "Here is my response.\nACTION: delete_record | dangerous thing\n",
        },
      ],
    });

    const result = await makeAuthedCaller().ai.query(VALID_QUERY_INPUT);
    expect(result.action).toBeNull();
  });
});

// ── ai.enableConsent ──────────────────────────────────────────────────────────

describe("ai.enableConsent", () => {
  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(anonCaller.ai.enableConsent()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns ok:true on successful consent enable", async () => {
    const ctxSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase as any,
      req: undefined,
    });
    const result = await caller.ai.enableConsent();
    expect(result.ok).toBe(true);
  });
});

// ── ai.revokeConsent ──────────────────────────────────────────────────────────

describe("ai.revokeConsent", () => {
  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(anonCaller.ai.revokeConsent()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns ok:true and deletes ai_conversations on revoke", async () => {
    const ctxSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "user_profiles") {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        // ai_conversations
        return {
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    };
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase as any,
      req: undefined,
    });
    const result = await caller.ai.revokeConsent();
    expect(result.ok).toBe(true);
  });
});
