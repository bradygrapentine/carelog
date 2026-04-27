/**
 * Tests for apps/web/app/api/trpc/[trpc]/route.ts
 *
 * Coverage goals:
 * - Route exports GET and POST handlers
 * - createContext is called to bootstrap user session
 * - 200 when context resolves (happy path)
 * - fetchRequestHandler is called with the correct endpoint
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── mocks ───────────────────────────────────────────────────────────────────

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockReturnValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

vi.mock("@trpc/server/adapters/fetch", () => ({
  fetchRequestHandler: vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ result: { data: { json: "pong" } } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ),
}));

// Repository mocks required by appRouter imports
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
    storage: { from: vi.fn() },
  },
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

vi.mock("@anthropic-ai/sdk", () => {
  const Ctor = function (this: unknown) {
    (this as any).messages = { create: vi.fn() };
  };
  return { default: Ctor };
});

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { GET, POST } from "../route";

// ── tests ────────────────────────────────────────────────────────────────────

describe("tRPC route handler", () => {
  beforeEach(() => {
    vi.mocked(fetchRequestHandler).mockClear();
  });

  it("exports a GET handler", () => {
    expect(typeof GET).toBe("function");
  });

  it("exports a POST handler", () => {
    expect(typeof POST).toBe("function");
  });

  it("GET delegates to fetchRequestHandler", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/trpc/ai.query?batch=1&input=%7B%7D",
      { method: "GET" },
    );
    const res = await GET(req);
    expect(fetchRequestHandler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it("POST delegates to fetchRequestHandler", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/trpc/ai.query?batch=1",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify([{ prompt: "hello" }]),
      },
    );
    const res = await POST(req);
    expect(fetchRequestHandler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it("fetchRequestHandler is called with /api/trpc endpoint", async () => {
    const req = new NextRequest("http://localhost:3000/api/trpc/ai.query");
    await GET(req);
    const [callArg] = vi.mocked(fetchRequestHandler).mock.calls[0]!;
    expect(callArg.endpoint).toBe("/api/trpc");
  });
});
