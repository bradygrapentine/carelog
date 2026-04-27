import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetRequestUser = vi.fn();
vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: (...args: unknown[]) => mockGetRequestUser(...args),
}));

const mockSupabaseFrom = vi.fn();
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}));

const mockPortalCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    billingPortal: {
      sessions: { create: (...args: unknown[]) => mockPortalCreate(...args) },
    },
  }),
}));

const TEST_ORG_ID = "00000000-0000-0000-0000-000000000001";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/stripe/portal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPortalCreate.mockResolvedValue({
      url: "https://billing.stripe.com/session_456",
    });
  });

  it("returns 401 without auth", async () => {
    mockGetRequestUser.mockResolvedValue(null);
    const { POST } = await import("../portal/route");
    const res = await POST(makeRequest({ orgId: TEST_ORG_ID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid input (missing orgId)", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user-1" });
    const { POST } = await import("../portal/route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-coordinator", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user-1" });
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
    const { POST } = await import("../portal/route");
    const res = await POST(makeRequest({ orgId: TEST_ORG_ID }));
    expect(res.status).toBe(403);
  });

  it("returns 400 if org has no stripe_id", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user-1" });
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
                data: { id: TEST_ORG_ID, stripe_id: null },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
    const { POST } = await import("../portal/route");
    const res = await POST(makeRequest({ orgId: TEST_ORG_ID }));
    expect(res.status).toBe(400);
  });

  it("returns portal URL", async () => {
    mockGetRequestUser.mockResolvedValue({ id: "user-1" });
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
                data: { id: TEST_ORG_ID, stripe_id: "cus_123" },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
    const { POST } = await import("../portal/route");
    const res = await POST(makeRequest({ orgId: TEST_ORG_ID }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toBe("https://billing.stripe.com/session_456");
  });

  it("H5: rejects request with a forged Origin not matching NEXT_PUBLIC_APP_URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.carelog.app";
    mockGetRequestUser.mockResolvedValue({ id: "user-1" });
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
                data: { id: TEST_ORG_ID, stripe_id: "cus_123" },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
    const req = new NextRequest("http://localhost:3000/api/stripe/portal", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example.com",
      },
      body: JSON.stringify({ orgId: TEST_ORG_ID }),
    });
    const { POST } = await import("../portal/route");
    const res = await POST(req);
    // Forged non-allowlisted Origin must be rejected
    expect(res.status).toBe(403);
    delete process.env.NEXT_PUBLIC_APP_URL;
  });
});
