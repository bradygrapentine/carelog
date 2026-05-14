import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---
const mockConstructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  }),
}));

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockSupabaseFrom = vi.fn().mockImplementation(() => ({
  update: mockUpdate,
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: "org-1", stripe_id: null },
        error: null,
      }),
    }),
  }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}));

function makeWebhookRequest(body: string, signature = "sig_valid") {
  return new NextRequest("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });
}

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("rejects invalid signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const { POST } = await import("../webhook/route");
    const res = await POST(makeWebhookRequest("{}", "bad_sig"));
    expect(res.status).toBe(400);
  });

  it("checkout.session.completed updates org to family plan", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_123",
          metadata: { orgId: "org-1" },
        },
      },
    });
    const { POST } = await import("../webhook/route");
    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockSupabaseFrom).toHaveBeenCalledWith("organizations");
    expect(mockUpdate).toHaveBeenCalledWith({
      plan: "family",
      stripe_id: "cus_123",
    });
  });

  it("customer.subscription.deleted resets org to free", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: { customer: "cus_123" },
      },
    });
    const { POST } = await import("../webhook/route");
    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      plan: "free",
      stripe_id: null,
    });
  });

  it("invoice.payment_failed returns 200 without DB change", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_123" } },
    });
    const { POST } = await import("../webhook/route");
    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("unknown event returns 200", async () => {
    mockConstructEvent.mockReturnValue({
      type: "some.unknown.event",
      data: { object: {} },
    });
    const { POST } = await import("../webhook/route");
    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
  });

  it("checkout.session.completed with no orgId in metadata does nothing", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_123",
          metadata: {},
        },
      },
    });
    const { POST } = await import("../webhook/route");
    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("customer.subscription.deleted when org lookup returns null does nothing", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: { customer: "cus_unknown" },
      },
    });
    mockSupabaseFrom.mockImplementation(() => ({
      update: mockUpdate,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));
    const { POST } = await import("../webhook/route");
    const res = await POST(makeWebhookRequest("{}"));
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// --- Handler-map dispatch gate (OOP-015 PR1) ---
// Asserts handlers[event.type] is defined for each known event type,
// that calling it has the expected side-effects (reusing top-level mocks),
// and unknown event types return undefined (no-op).
describe("handler-map dispatch (OOP-015)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    // Restore mockSupabaseFrom after clearAllMocks wipes implementations.
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockSupabaseFrom.mockImplementation(() => ({
      update: mockUpdate,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "org-1", stripe_id: null },
            error: null,
          }),
        }),
      }),
    }));
  });

  it("handlers map contains exactly the 4 known event types", async () => {
    const { handlers } = await import("../webhook/handlers/index");
    expect(Object.keys(handlers).sort()).toEqual([
      "checkout.session.completed",
      "customer.subscription.deleted",
      "customer.subscription.updated",
      "invoice.payment_failed",
    ]);
  });

  it("unknown event type has no handler entry (no-op)", async () => {
    const { handlers } = await import("../webhook/handlers/index");
    expect(handlers["some.unknown.event"]).toBeUndefined();
  });

  it("checkout.session.completed handler updates org when invoked directly", async () => {
    const { handlers } = await import("../webhook/handlers/index");
    const handler = handlers["checkout.session.completed"];
    expect(handler).toBeDefined();
    const event = {
      type: "checkout.session.completed",
      data: { object: { customer: "cus_123", metadata: { orgId: "org-1" } } },
    };
    await handler!(event as never);
    expect(mockSupabaseFrom).toHaveBeenCalledWith("organizations");
    expect(mockUpdate).toHaveBeenCalledWith({
      plan: "family",
      stripe_id: "cus_123",
    });
  });

  it("customer.subscription.deleted handler resets org when invoked directly", async () => {
    const { handlers } = await import("../webhook/handlers/index");
    const handler = handlers["customer.subscription.deleted"];
    expect(handler).toBeDefined();
    const event = {
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_123" } },
    };
    await handler!(event as never);
    expect(mockUpdate).toHaveBeenCalledWith({ plan: "free", stripe_id: null });
  });

  it("invoice.payment_failed handler runs without DB mutation when invoked directly", async () => {
    const { handlers } = await import("../webhook/handlers/index");
    const handler = handlers["invoice.payment_failed"];
    expect(handler).toBeDefined();
    const event = {
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_123" } },
    };
    await handler!(event as never);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
