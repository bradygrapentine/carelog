/**
 * Tests for apps/web/app/api/outer-circle/[shareToken]/route.ts
 *
 * Coverage goals:
 * - 404 when share token not found
 * - 404 when request is inactive
 * - 200 returns public request fields on valid active token
 * - Response contains all expected fields
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

import { GET } from "../route";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const SHARE_TOKEN = "test-share-token-abc123";
const REQUEST_ID = "50000000-0000-0000-0000-000000000001";

type RouteContext = { params: Promise<{ shareToken: string }> };

function makeParams(token: string): RouteContext {
  return { params: Promise.resolve({ shareToken: token }) };
}

function makeGetRequest(token: string): NextRequest {
  return new NextRequest(`http://localhost/api/outer-circle/${token}`, {
    method: "GET",
  });
}

function makeSelectChain(result: object) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  return chain as unknown;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

describe("GET /api/outer-circle/[shareToken]", () => {
  it("returns 404 when the share token is not found", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { message: "Not found" } }) as any,
    );

    const res = await GET(makeGetRequest(SHARE_TOKEN), makeParams(SHARE_TOKEN));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("returns 404 when the request is inactive", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({
        data: {
          id: REQUEST_ID,
          title: "Help with groceries",
          description: "Need help weekly",
          request_type: "recurring",
          slots_total: 2,
          slots_filled: 0,
          needed_by: null,
          active: false,
        },
        error: null,
      }) as any,
    );

    const res = await GET(makeGetRequest(SHARE_TOKEN), makeParams(SHARE_TOKEN));
    expect(res.status).toBe(404);
  });

  it("returns 200 with request fields when token is valid and active", async () => {
    const mockRequest = {
      id: REQUEST_ID,
      title: "Help with groceries",
      description: "Need help weekly",
      request_type: "recurring",
      slots_total: 3,
      slots_filled: 1,
      needed_by: "2026-05-01",
      active: true,
    };

    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: mockRequest, error: null }) as any,
    );

    const res = await GET(makeGetRequest(SHARE_TOKEN), makeParams(SHARE_TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(REQUEST_ID);
    expect(body.title).toBe("Help with groceries");
    expect(body.slots_total).toBe(3);
    expect(body.active).toBe(true);
  });

  it("returns all expected fields in the response", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({
        data: {
          id: REQUEST_ID,
          title: "Ride to appointment",
          description: "Tuesday mornings",
          request_type: "one_time",
          slots_total: 1,
          slots_filled: 0,
          needed_by: "2026-04-30",
          active: true,
        },
        error: null,
      }) as any,
    );

    const res = await GET(makeGetRequest(SHARE_TOKEN), makeParams(SHARE_TOKEN));
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      [
        "id",
        "title",
        "description",
        "request_type",
        "slots_total",
        "slots_filled",
        "needed_by",
        "active",
      ].sort(),
    );
  });
});
