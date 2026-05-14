import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabaseServer", () => ({ getRequestUser: vi.fn() }));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

import { getRequestUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;

const makeReq = (body: unknown) =>
  new NextRequest("http://localhost/api/ocr/save-fields", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("POST /api/ocr/save-fields", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid body", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u1",
    });
    const res = await POST(makeReq({ jobId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not the uploader", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u1",
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "job-1", created_by: "u2" },
        error: null,
      }),
    });
    const res = await POST(
      makeReq({
        jobId: "00000000-0000-0000-0000-000000000001",
        fields: [
          { label: "Test", value: "Val", type: "text", confidence: 0.9 },
        ],
      }),
    );
    expect(res.status).toBe(403);
  });

  it("saves fields and returns ok", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "u1",
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function (this: unknown) {
        return this;
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "job-1",
          created_by: "u1",
          parsed_data: { document_type: "bill", fields: [] },
          status: "needs_review",
        },
        error: null,
      }),
      // Optimistic-lock UPDATE chain: .update(..).eq(..).eq(..).select(..) resolves with count: 1
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi
              .fn()
              .mockResolvedValue({ data: null, error: null, count: 1 }),
          }),
        }),
      }),
    });
    const res = await POST(
      makeReq({
        jobId: "00000000-0000-0000-0000-000000000001",
        fields: [
          { label: "Total", value: "$50", type: "currency", confidence: 0.9 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
