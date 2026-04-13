import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabaseServer", () => ({ getRequestUser: vi.fn() }));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { getRequestUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;

describe("GET /api/ocr/job/[jobId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/ocr/job/some-id");
    const res = await GET(req, {
      params: Promise.resolve({ jobId: "some-id" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when job not found", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-1",
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: "not found" } }),
    });
    const req = new NextRequest("http://localhost/api/ocr/job/missing-id");
    const res = await GET(req, {
      params: Promise.resolve({ jobId: "missing-id" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns job when found and owned by user", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-1",
    });
    const fakeJob = {
      id: "job-1",
      status: "needs_review",
      parsed_data: { document_type: "bill", fields: [] },
      created_by: "user-1",
    };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: fakeJob, error: null }),
    });
    const req = new NextRequest("http://localhost/api/ocr/job/job-1");
    const res = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job.id).toBe("job-1");
  });

  it("returns 403 when user does not own job", async () => {
    (getRequestUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "user-2",
    });
    const fakeJob = {
      id: "job-1",
      status: "needs_review",
      created_by: "user-1",
    };
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: fakeJob, error: null }),
    });
    const req = new NextRequest("http://localhost/api/ocr/job/job-1");
    const res = await GET(req, {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    expect(res.status).toBe(403);
  });
});
