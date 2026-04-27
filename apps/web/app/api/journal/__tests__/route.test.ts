/**
 * Tests for apps/web/app/api/journal/route.ts
 *
 * Coverage goals:
 * - GET 401 when unauthenticated
 * - GET 400 on invalid recipientId
 * - GET 200 on valid request
 * - POST 401 when unauthenticated
 * - POST 403 when not an org member
 * - POST 403 when recipient doesn't belong to org
 * - POST 200 on valid journal entry
 * - POST 200 on duplicate clientId (idempotent)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabaseServer", () => ({
  createRequestSupabase: vi.fn(),
  getRequestUser: vi.fn(),
}));

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@carelog/schemas", () => ({
  journalPayload: {
    parse: vi.fn((v: unknown) => v),
  },
}));

import { GET, POST } from "../route";
import { getRequestUser, createRequestSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const USER_ID = "aaaa0001-0000-0000-0000-000000000001";
const ORG_ID = "10000000-0000-0000-0000-000000000001";
const RECIP_ID = "20000000-0000-0000-0000-000000000001";
const EVENT_ID = "30000000-0000-0000-0000-000000000001";

function makeChain(result: object): unknown {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.not = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.insert = () => chain;
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

function getRequest(params = "") {
  return new NextRequest(
    `http://localhost/api/journal${params ? "?" + params : ""}`,
    { method: "GET" },
  );
}

function postRequest(body: object) {
  return new NextRequest("http://localhost/api/journal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(getRequestUser).mockReset();
  vi.mocked(createRequestSupabase).mockReset();
  vi.mocked(supabaseAdmin.from).mockReset();
});

// ── GET ───────────────────────────────────────────────────────────────────────

describe("GET /api/journal", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(createRequestSupabase).mockResolvedValue({
      from: vi.fn().mockReturnValue(makeChain({ data: null, error: null })),
    } as any);
    vi.mocked(getRequestUser).mockResolvedValue(null);

    const res = await GET(getRequest(`recipientId=${RECIP_ID}`));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/i);
  });

  it("returns 400 when recipientId is invalid UUID", async () => {
    vi.mocked(createRequestSupabase).mockResolvedValue({
      from: vi.fn().mockReturnValue(makeChain({ data: null, error: null })),
    } as any);
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const res = await GET(getRequest("recipientId=not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when recipientId is absent", async () => {
    vi.mocked(createRequestSupabase).mockResolvedValue({
      from: vi.fn().mockReturnValue(makeChain({ data: null, error: null })),
    } as any);
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const res = await GET(getRequest(""));
    expect(res.status).toBe(400);
  });

  it("returns 200 with events list on valid request", async () => {
    const events = [{ id: EVENT_ID, payload: { text: "hello" } }];
    const supabaseWithEvents = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: events, error: null }),
      }),
    };
    vi.mocked(createRequestSupabase).mockResolvedValue(
      supabaseWithEvents as any,
    );
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const res = await GET(getRequest(`recipientId=${RECIP_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
  });
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/journal", () => {
  const validBody = {
    recipientId: RECIP_ID,
    orgId: ORG_ID,
    text: "Journal entry text",
  };

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null);

    const res = await POST(postRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not an org member", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeChain({ data: null, error: null }) as any,
    );

    const res = await POST(postRequest(validBody));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Forbidden/i);
  });

  it("returns 403 when recipient doesn't belong to the org", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({ data: { id: "m1" }, error: null }) as any;
      }
      return makeChain({ data: null, error: null }) as any;
    });

    const res = await POST(postRequest(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 200 on valid journal entry insert", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const insertedEvent = {
      id: EVENT_ID,
      payload: { text: "Journal entry text" },
    };
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({ data: { id: "m1" }, error: null }) as any;
      }
      if (callCount === 2) {
        return makeChain({ data: { id: RECIP_ID }, error: null }) as any;
      }
      const chain: Record<string, unknown> = {};
      chain.insert = () => chain;
      chain.select = () => chain;
      chain.single = vi
        .fn()
        .mockResolvedValue({ data: insertedEvent, error: null });
      return chain as any;
    });

    const res = await POST(postRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.id).toBe(EVENT_ID);
  });

  it("returns 200 (idempotent) on duplicate clientId", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const existingEvent = { id: EVENT_ID };
    const CLIENT_ID = "cccccccc-0000-0000-0000-000000000001";
    let callCount = 0;

    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({ data: { id: "m1" }, error: null }) as any;
      }
      if (callCount === 2) {
        return makeChain({ data: { id: RECIP_ID }, error: null }) as any;
      }
      if (callCount === 3) {
        const chain: Record<string, unknown> = {};
        chain.insert = () => chain;
        chain.select = () => chain;
        chain.single = vi
          .fn()
          .mockResolvedValue({ data: null, error: { code: "23505" } });
        return chain as any;
      }
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = vi
        .fn()
        .mockResolvedValue({ data: existingEvent, error: null });
      return chain as any;
    });

    const res = await POST(postRequest({ ...validBody, clientId: CLIENT_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.event.id).toBe(EVENT_ID);
  });
});
