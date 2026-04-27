/**
 * Tests for apps/web/app/api/journal/[eventId]/reactions/route.ts
 *
 * Coverage goals:
 * - GET/POST/DELETE 401 when unauthenticated
 * - GET/POST/DELETE 400 on invalid eventId
 * - GET/POST/DELETE 403 when user can't access event
 * - GET 200 returns counts and myReaction
 * - POST 200 upserts reaction
 * - DELETE 200 removes reaction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

import { GET, POST, DELETE } from "../route";
import { getRequestUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const USER_ID = "aaaa0001-0000-0000-0000-000000000001";
const ORG_ID = "10000000-0000-0000-0000-000000000001";
const EVENT_ID = "30000000-0000-0000-0000-000000000001";
const MEMBERSHIP_ID = "40000000-0000-0000-0000-000000000001";

type RouteContext = { params: Promise<{ eventId: string }> };

function makeParams(eventId: string): RouteContext {
  return { params: Promise.resolve({ eventId }) };
}

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest(`http://localhost/api/journal/${EVENT_ID}/reactions`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeChain(result: object): unknown {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.not = () => chain;
  chain.upsert = () => chain;
  chain.delete = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

/** Deny access — care_events lookup returns null */
function denyAccess() {
  vi.mocked(supabaseAdmin.from).mockReturnValue(
    makeChain({ data: null, error: null }) as any,
  );
}

beforeEach(() => {
  vi.mocked(getRequestUser).mockReset();
  vi.mocked(supabaseAdmin.from).mockReset();
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/journal/[eventId]/reactions", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null);
    const res = await GET(makeRequest("GET"), makeParams(EVENT_ID));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid eventId UUID", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);
    const res = await GET(makeRequest("GET"), makeParams("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user cannot access the event", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);
    denyAccess();
    const res = await GET(makeRequest("GET"), makeParams(EVENT_ID));
    expect(res.status).toBe(403);
  });

  it("returns 200 with reaction counts and myReaction", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      callCount++;
      if (table === "care_events") {
        return makeChain({ data: { org_id: ORG_ID }, error: null }) as any;
      }
      if (table === "memberships") {
        return makeChain({ data: { id: MEMBERSHIP_ID }, error: null }) as any;
      }
      // journal_reactions — third call
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = vi.fn().mockResolvedValue({
        data: [
          { reaction: "heart", user_id: USER_ID },
          { reaction: "heart", user_id: "other-user-id" },
        ],
        error: null,
      });
      return chain as any;
    });

    const res = await GET(makeRequest("GET"), makeParams(EVENT_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counts).toBeDefined();
    expect(body.myReaction).toBe("heart");
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/journal/[eventId]/reactions", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null);
    const res = await POST(
      makeRequest("POST", { reaction: "heart" }),
      makeParams(EVENT_ID),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid eventId UUID", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);
    const res = await POST(
      makeRequest("POST", { reaction: "heart" }),
      makeParams("bad-id"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when user cannot access the event", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);
    denyAccess();
    const res = await POST(
      makeRequest("POST", { reaction: "heart" }),
      makeParams(EVENT_ID),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 on valid reaction upsert", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "care_events") {
        return makeChain({ data: { org_id: ORG_ID }, error: null }) as any;
      }
      if (table === "memberships") {
        return makeChain({ data: { id: MEMBERSHIP_ID }, error: null }) as any;
      }
      const chain: Record<string, unknown> = {};
      chain.upsert = vi.fn().mockResolvedValue({ error: null });
      return chain as any;
    });

    const res = await POST(
      makeRequest("POST", { reaction: "heart" }),
      makeParams(EVENT_ID),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/journal/[eventId]/reactions", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE"), makeParams(EVENT_ID));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user cannot access the event", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);
    denyAccess();
    const res = await DELETE(makeRequest("DELETE"), makeParams(EVENT_ID));
    expect(res.status).toBe(403);
  });

  it("returns 200 on valid reaction delete", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "care_events") {
        return makeChain({ data: { org_id: ORG_ID }, error: null }) as any;
      }
      if (table === "memberships") {
        return makeChain({ data: { id: MEMBERSHIP_ID }, error: null }) as any;
      }
      const chain: Record<string, unknown> = {};
      chain.delete = () => chain;
      chain.eq = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(resolve);
      return chain as any;
    });

    const res = await DELETE(makeRequest("DELETE"), makeParams(EVENT_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
