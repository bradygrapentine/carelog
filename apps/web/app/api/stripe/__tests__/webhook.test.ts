import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---
const mockConstructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  },
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
