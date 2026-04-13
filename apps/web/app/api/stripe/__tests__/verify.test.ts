import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---
const mockGetRequestUser = vi.fn();
vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: (...args: unknown[]) => mockGetRequestUser(...args),
}));

const mockSessionRetrieve = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        retrieve: (...args: unknown[]) => mockSessionRetrieve(...args),
      },
    },
  }),
}));

const mockSingle = vi.fn();
const mockSupabaseFrom = vi.fn();
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}));

function makeRequest(sessionId?: string) {
  const url = sessionId
    ? `http://localhost:3000/api/stripe/verify?session_id=${sessionId}`
    : "http://localhost:3000/api/stripe/verify";
  return new NextRequest(url);
}

function setupMembershipMock(membershipData: { role: string } | null) {
  mockSingle.mockResolvedValue({ data: membershipData, error: null });
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle,
        }),
      }),
    }),
  });
}

describe("GET /api/stripe/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user not authenticated", async () => {
    mockGetRequestUser.mockResolvedValue(null);
    const { GET } = await import("../verify/route");
    const res = await GET(makeRequest("cs_test"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when session_id query param is missing", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user-1" });
    const { GET } = await import("../verify/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not a member of the org in session metadata", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user-1" });
    mockSessionRetrieve.mockResolvedValue({
      payment_status: "paid",
      metadata: { orgId: "org-abc", interval: "month" },
    });
    setupMembershipMock(null);
    const { GET } = await import("../verify/route");
    const res = await GET(makeRequest("cs_test"));
    expect(res.status).toBe(403);
  });

  it("returns payment status and interval on success", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user-1" });
    mockSessionRetrieve.mockResolvedValue({
      payment_status: "paid",
      metadata: { orgId: "org-abc", interval: "year" },
    });
    setupMembershipMock({ role: "coordinator" });
    const { GET } = await import("../verify/route");
    const res = await GET(makeRequest("cs_test"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("paid");
    expect(body.interval).toBe("year");
    expect(body.plan).toBe("family");
  });

  it("returns default interval 'month' when metadata.interval is missing", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user-1" });
    mockSessionRetrieve.mockResolvedValue({
      payment_status: "paid",
      metadata: { orgId: "org-abc" },
    });
    setupMembershipMock({ role: "coordinator" });
    const { GET } = await import("../verify/route");
    const res = await GET(makeRequest("cs_test"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.interval).toBe("month");
  });

  it("returns 404 when Stripe session not found", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user-1" });
    mockSessionRetrieve.mockRejectedValue(
      new Error("No such checkout.session"),
    );
    const { GET } = await import("../verify/route");
    const res = await GET(makeRequest("cs_invalid"));
    expect(res.status).toBe(404);
  });
});
