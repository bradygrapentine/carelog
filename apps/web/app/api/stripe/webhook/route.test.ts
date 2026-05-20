/**
 * SEC-002: Stripe webhook event-ID deduplication tests.
 *
 * Coverage goals:
 * - Valid first delivery: dedup insert succeeds → handler dispatched → 200 received.
 * - Duplicate delivery: dedup upsert returns empty rows → 200 duplicate (handler NOT called).
 * - Dedup DB error: insert fails → 500 returned (handler NOT called).
 * - Invalid signature: 400 returned before dedup.
 *
 * TD-202: handler failure must return non-2xx AND roll back the dedup row, so
 * Stripe's automatic retry re-processes the event instead of being short-circuited
 * as a duplicate (the row is inserted before the handler runs).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
}));

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn(() => ({ capture: vi.fn() })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

vi.mock("./handlers", () => ({
  handlers: {
    "customer.subscription.updated": vi.fn().mockResolvedValue(undefined),
  },
}));

import { POST } from "./route";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { handlers } from "./handlers";

// ── helpers ──────────────────────────────────────────────────────────────────

const FAKE_EVENT = {
  id: "evt_test_abc123",
  type: "customer.subscription.updated",
  data: { object: { customer: "cus_test" } },
};

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=sig" },
    body: JSON.stringify(FAKE_EVENT),
  });
}

/**
 * Build a Supabase chain that resolves with the given result at .select() (the
 * dedup upsert) and supports the rollback `.delete().eq()` path (TD-202). The
 * `eq` spy is exposed so tests can assert the dedup row was rolled back and
 * simulate a rollback failure.
 */
function makeUpsertChain(
  result: { data: unknown[] | null; error: unknown },
  deleteResult: { error: unknown } = { error: null },
) {
  const chain: Record<string, unknown> = {};
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockResolvedValue(result);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockResolvedValue(deleteResult);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: constructEvent succeeds
  (getStripe as ReturnType<typeof vi.fn>).mockReturnValue({
    webhooks: {
      constructEvent: vi.fn().mockReturnValue(FAKE_EVENT),
    },
  });
});

// ── tests ────────────────────────────────────────────────────────────────────

describe("POST /api/stripe/webhook", () => {
  it("first delivery: handler called, returns { received: true }", async () => {
    const chain = makeUpsertChain({
      data: [{ event_id: FAKE_EVENT.id }],
      error: null,
    });
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(handlers["customer.subscription.updated"]).toHaveBeenCalledTimes(1);
  });

  it("duplicate delivery: handler NOT called, returns { duplicate: true }", async () => {
    const chain = makeUpsertChain({ data: [], error: null });
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ duplicate: true });
    expect(handlers["customer.subscription.updated"]).not.toHaveBeenCalled();
  });

  it("dedup DB error: returns 500, handler NOT called", async () => {
    const chain = makeUpsertChain({
      data: null,
      error: { message: "db error" },
    });
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Dedup check failed" });
    expect(handlers["customer.subscription.updated"]).not.toHaveBeenCalled();
  });

  it("handler throws: returns 500 and rolls back the dedup row (TD-202)", async () => {
    const chain = makeUpsertChain({
      data: [{ event_id: FAKE_EVENT.id }],
      error: null,
    });
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (
      handlers["customer.subscription.updated"] as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error("boom"));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "handler_failed" });
    // Dedup row must be deleted so Stripe's retry re-processes (not short-circuited).
    expect(chain.delete).toHaveBeenCalledTimes(1);
    expect(chain.eq).toHaveBeenCalledWith("event_id", FAKE_EVENT.id);
  });

  it("handler throws AND rollback fails: still returns 500 (TD-202)", async () => {
    const chain = makeUpsertChain(
      { data: [{ event_id: FAKE_EVENT.id }], error: null },
      { error: { message: "delete failed" } },
    );
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    (
      handlers["customer.subscription.updated"] as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error("boom"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(chain.delete).toHaveBeenCalledTimes(1);
  });

  it("invalid signature: returns 400 before dedup", async () => {
    (getStripe as ReturnType<typeof vi.fn>).mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => {
          throw new Error("Stripe signature verification failed");
        }),
      },
    });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Invalid signature" });
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(handlers["customer.subscription.updated"]).not.toHaveBeenCalled();
  });
});
