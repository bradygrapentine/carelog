// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { GET } from "../route";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const ORG_ID = "22222222-2222-2222-2222-222222222222";
const MEMBER_ID_A = "33333333-3333-3333-3333-333333333333";
const MEMBER_ID_B = "44444444-4444-4444-4444-444444444444";

function makeGetRequest(orgId: string | null) {
  const url = new URL("http://localhost:3000/api/members");
  if (orgId) url.searchParams.set("orgId", orgId);
  return new NextRequest(url.toString(), { method: "GET" });
}

describe("GET /api/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(makeGetRequest(ORG_ID));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid orgId", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: USER_ID,
    });
    const res = await GET(makeGetRequest("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 403 when caller is not a member", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: USER_ID,
    });
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    const res = await GET(makeGetRequest(ORG_ID));
    expect(res.status).toBe(403);
  });

  it("H4: coordinator sees email field for all members", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: USER_ID,
    });
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "m1", role: "coordinator" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: [{ id: "m1", role: "coordinator", user_id: MEMBER_ID_A }],
            error: null,
          }),
        };
      }
      if (table === "user_profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: MEMBER_ID_A,
                display_name: "Alice",
                email: "alice@example.com",
              },
            ],
            error: null,
          }),
        };
      }
      return {};
    });
    const res = await GET(makeGetRequest(ORG_ID));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.members[0].email).toBe("alice@example.com");
  });

  it("H4: non-coordinator does not receive email field", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: USER_ID,
    });
    const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "m2", role: "caregiver" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: [
              { id: "m2", role: "caregiver", user_id: MEMBER_ID_B },
              { id: "m1", role: "coordinator", user_id: MEMBER_ID_A },
            ],
            error: null,
          }),
        };
      }
      if (table === "user_profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: MEMBER_ID_A,
                display_name: "Alice",
                email: "alice@example.com",
              },
              {
                id: MEMBER_ID_B,
                display_name: "Bob",
                email: "bob@example.com",
              },
            ],
            error: null,
          }),
        };
      }
      return {};
    });
    const res = await GET(makeGetRequest(ORG_ID));
    const body = await res.json();
    expect(res.status).toBe(200);
    // All members should have null email when caller is not coordinator
    for (const member of body.members) {
      expect(member.email).toBeNull();
    }
  });
});
