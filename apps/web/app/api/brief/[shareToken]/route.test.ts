import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

import { GET } from "./route";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { rateLimit } from "@/lib/rateLimit";

const TOKEN = "abc123sharetoken";
const BRIEF_ID = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

function getRequest(shareToken: string) {
  return new NextRequest("http://localhost/api/brief/" + shareToken, {
    method: "GET",
  });
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(rateLimit).mockResolvedValue(null);
});

describe("GET /api/brief/[shareToken]", () => {
  it("returns 429 and does not call supabaseAdmin when rate limited", async () => {
    const limitedResponse = NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
    vi.mocked(rateLimit).mockResolvedValueOnce(limitedResponse);

    const res = await GET(getRequest(TOKEN), {
      params: Promise.resolve({ shareToken: TOKEN }),
    });
    expect(res.status).toBe(429);
    expect(vi.mocked(supabaseAdmin.from)).not.toHaveBeenCalled();
  });

  it("returns 404 when brief not found", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: null,
          error: { message: "No rows returned" },
        }) as any,
    );

    const res = await GET(getRequest(TOKEN), {
      params: Promise.resolve({ shareToken: TOKEN }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 410 when brief is expired", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: {
            id: BRIEF_ID,
            title: "Test Brief",
            content: {},
            includes: ["medications"],
            expires_at: pastDate,
            revoked: false,
            created_at: "2026-01-01T00:00:00Z",
          },
          error: null,
        }) as any,
    );

    const res = await GET(getRequest(TOKEN), {
      params: Promise.resolve({ shareToken: TOKEN }),
    });
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/expired/);
  });

  it("returns 200 with brief content on success", async () => {
    const futureDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: {
            id: BRIEF_ID,
            title: "Care Brief for Jane",
            content: { recipient_name: "Jane Doe", medications: [] },
            includes: ["medications", "journal"],
            expires_at: futureDate,
            revoked: false,
            created_at: "2026-04-01T00:00:00Z",
          },
          error: null,
        }) as any,
    );

    const res = await GET(getRequest(TOKEN), {
      params: Promise.resolve({ shareToken: TOKEN }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(BRIEF_ID);
    expect(body.title).toBe("Care Brief for Jane");
    expect(body.content).toBeDefined();
    expect(body.includes).toEqual(["medications", "journal"]);
    expect(body.created_at).toBe("2026-04-01T00:00:00Z");
  });

  it('redacts content.dob when includes does not contain "dob" (UX-045 PHI gate)', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: {
            id: BRIEF_ID,
            title: "Family share",
            content: {
              recipient_name: "Jane Doe",
              dob: "1942-03-12",
              medications: [],
            },
            includes: ["medications", "journal"],
            expires_at: null,
            revoked: false,
            created_at: "2026-04-01T00:00:00Z",
          },
          error: null,
        }) as any,
    );

    const res = await GET(getRequest(TOKEN), {
      params: Promise.resolve({ shareToken: TOKEN }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content).not.toHaveProperty("dob");
    expect(body.content.recipient_name).toBe("Jane Doe");
  });

  it('exposes content.dob when includes contains "dob" (clinician opt-in)', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: {
            id: BRIEF_ID,
            title: "Clinician share",
            content: {
              recipient_name: "Jane Doe",
              dob: "1942-03-12",
              medications: [],
            },
            includes: ["medications", "journal", "dob"],
            expires_at: null,
            revoked: false,
            created_at: "2026-04-01T00:00:00Z",
          },
          error: null,
        }) as any,
    );

    const res = await GET(getRequest(TOKEN), {
      params: Promise.resolve({ shareToken: TOKEN }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content.dob).toBe("1942-03-12");
  });

  it("does not expose the revoked field in the response", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: {
            id: BRIEF_ID,
            title: "Test",
            content: {},
            includes: [],
            expires_at: null,
            revoked: false,
            created_at: "2026-04-01T00:00:00Z",
          },
          error: null,
        }) as any,
    );

    const res = await GET(getRequest(TOKEN), {
      params: Promise.resolve({ shareToken: TOKEN }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("revoked");
  });
});
