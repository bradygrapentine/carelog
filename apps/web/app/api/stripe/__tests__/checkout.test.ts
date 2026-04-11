import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---
const mockGetRequestUser = vi.fn();
vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: (...args: unknown[]) => mockGetRequestUser(...args),
}));

const mockSupabaseFrom = vi.fn();
const mockSupabaseAdmin = { from: mockSupabaseFrom };
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

const mockCheckoutCreate = vi.fn();
const mockCustomerCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: { create: (...args: unknown[]) => mockCheckoutCreate(...args) },
    },
    customers: { create: (...args: unknown[]) => mockCustomerCreate(...args) },
  },
}));

const TEST_ORG_ID = "00000000-0000-0000-0000-000000000001";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Helper: set up valid coordinator with free org
function setupCoordinator(overrides?: {
  plan?: string;
  stripe_id?: string | null;
}) {
  mockGetRequestUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
  // Membership lookup
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "memberships") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: "coordinator" },
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === "organizations") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: TEST_ORG_ID,
                name: "Test Org",
                plan: overrides?.plan ?? "free",
                stripe_id: overrides?.stripe_id ?? null,
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    return {};
  });
}

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: mock a successful checkout session
    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });
    mockCustomerCreate.mockResolvedValue({ id: "cus_new" });
  });

  it("returns 401 without auth", async () => {
    mockGetRequestUser.mockResolvedValue(null);
    const { POST } = await import("../checkout/route");
    const res = await POST(makeRequest({ orgId: "org-1", interval: "month" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-coordinator", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user-1", email: "a@b.com" });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "memberships") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "caregiver" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });
    const { POST } = await import("../checkout/route");
    const res = await POST(
      makeRequest({ orgId: TEST_ORG_ID, interval: "month" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 if org already on paid plan", async () => {
    setupCoordinator({ plan: "family" });
    const { POST } = await import("../checkout/route");
    const res = await POST(
      makeRequest({ orgId: TEST_ORG_ID, interval: "month" }),
    );
    expect(res.status).toBe(400);
  });

  it("creates Stripe customer if none exists", async () => {
    setupCoordinator({ stripe_id: null });
    const { POST } = await import("../checkout/route");
    await POST(makeRequest({ orgId: TEST_ORG_ID, interval: "month" }));
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.com" }),
    );
  });

  it("reuses existing Stripe customer", async () => {
    setupCoordinator({ stripe_id: "cus_existing" });
    const { POST } = await import("../checkout/route");
    await POST(makeRequest({ orgId: TEST_ORG_ID, interval: "month" }));
    expect(mockCustomerCreate).not.toHaveBeenCalled();
  });

  it("returns checkout URL", async () => {
    setupCoordinator();
    const { POST } = await import("../checkout/route");
    const res = await POST(
      makeRequest({ orgId: TEST_ORG_ID, interval: "month" }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.com/session_123");
  });

  it("uses monthly price for interval=month", async () => {
    setupCoordinator();
    const { POST } = await import("../checkout/route");
    await POST(makeRequest({ orgId: TEST_ORG_ID, interval: "month" }));
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: process.env.STRIPE_PRICE_MONTHLY, quantity: 1 }],
      }),
    );
  });

  it("uses annual price for interval=year", async () => {
    setupCoordinator();
    const { POST } = await import("../checkout/route");
    await POST(makeRequest({ orgId: TEST_ORG_ID, interval: "year" }));
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: process.env.STRIPE_PRICE_ANNUAL, quantity: 1 }],
      }),
    );
  });
});
