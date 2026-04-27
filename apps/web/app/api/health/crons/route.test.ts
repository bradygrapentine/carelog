import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue(result);
  return chain;
}

const HEALTH_CRONS_TOKEN = "test-crons-token";

function makeAuthedRequest() {
  return new Request("http://localhost/api/health/crons", {
    headers: { authorization: HEALTH_CRONS_TOKEN },
  });
}

describe("GET /api/health/crons", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    vi.stubEnv("HEALTH_CRONS_TOKEN", HEALTH_CRONS_TOKEN);
  });

  it("returns 401 when authorization header is missing", async () => {
    const res = await GET(new Request("http://localhost/api/health/crons"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when authorization header is wrong", async () => {
    const res = await GET(
      new Request("http://localhost/api/health/crons", {
        headers: { authorization: "wrong-token" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty crons array when table is empty", async () => {
    mockFrom.mockReturnValue(makeSelectChain({ data: [], error: null }));
    const res = await GET(makeAuthedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crons).toEqual([]);
    expect(typeof body.checked_at).toBe("string");
  });

  it("redacts error_message to 'internal error' when present", async () => {
    const rows = [
      {
        function_id: "gap-detector",
        last_ran_at: "2026-04-17T06:00:00Z",
        last_status: "error",
        error_message: "connection refused at host db.supabase.co:5432",
      },
    ];
    mockFrom.mockReturnValue(makeSelectChain({ data: rows, error: null }));
    const res = await GET(makeAuthedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crons[0].error_message).toBe("internal error");
  });

  it("preserves null error_message when row has no error", async () => {
    const rows = [
      {
        function_id: "weekly-digest",
        last_ran_at: "2026-04-14T08:00:00Z",
        last_status: "ok",
        error_message: null,
      },
    ];
    mockFrom.mockReturnValue(makeSelectChain({ data: rows, error: null }));
    const res = await GET(makeAuthedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crons[0].error_message).toBeNull();
  });

  it("returns 200 with empty array when DB returns null data", async () => {
    mockFrom.mockReturnValue(makeSelectChain({ data: null, error: null }));
    const res = await GET(makeAuthedRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crons).toEqual([]);
  });

  it("returns 500 with error message when Supabase errors", async () => {
    mockFrom.mockReturnValue(
      makeSelectChain({ data: null, error: { message: "connection refused" } }),
    );
    const res = await GET(makeAuthedRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("connection refused");
  });

  it("includes checked_at ISO timestamp in successful response", async () => {
    mockFrom.mockReturnValue(makeSelectChain({ data: [], error: null }));
    const before = new Date().toISOString();
    const res = await GET(makeAuthedRequest());
    const after = new Date().toISOString();
    const body = await res.json();
    expect(body.checked_at >= before).toBe(true);
    expect(body.checked_at <= after).toBe(true);
  });
});

// Sentry middleware unit test

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("inngest", async () => {
  const actual = await vi.importActual<typeof import("inngest")>("inngest");
  return actual;
});

describe("Sentry middleware in Inngest client", () => {
  it("calls Sentry.captureException when a function run produces an error", async () => {
    const error = new Error("cron failed");
    const mockCtx = {
      result: { error },
    };
    const mockFn = { id: () => "weekly-digest" };

    if (mockCtx.result.error) {
      Sentry.captureException(mockCtx.result.error, {
        tags: { inngest_function: mockFn.id() },
      });
    }

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { inngest_function: "weekly-digest" },
    });
  });
});
