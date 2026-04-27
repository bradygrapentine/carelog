import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/buildHistoryExport", () => ({
  buildHistoryExport: vi.fn(),
}));

vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  View: ({ children }: any) => children,
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

import { getRequestUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { buildHistoryExport } from "@/lib/buildHistoryExport";
import { POST } from "../route";

const ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const REC_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const mockSnapshot = {
  generated_at: "2024-01-01T00:00:00Z",
  recipient_id: REC_ID,
  recipient_name: "Jane Doe",
  dob: "1940-01-01",
  care_events: [],
  medications: [],
  symptom_readings: [],
  eol_plan: null,
  documents_metadata: [],
};

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/history/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSelectChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
  };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.mocked(getRequestUser).mockReset();
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(buildHistoryExport).mockReset();
});

describe("POST /api/history/export/pdf", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null as any);
    const req = makeRequest({ org_id: ORG_ID, recipient_id: REC_ID });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({
      id: USER_ID,
      email: "coord@test.com",
    } as any);
    const req = makeRequest({ org_id: "not-a-uuid" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not coordinator", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({
      id: USER_ID,
      email: "aide@test.com",
    } as any);
    vi.mocked(supabaseAdmin.from).mockImplementation(
      () =>
        makeSelectChain({
          data: { role: "aide", accepted_at: "2024-01-01T00:00:00Z" },
          error: null,
        }) as any,
    );
    const req = makeRequest({ org_id: ORG_ID, recipient_id: REC_ID });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when membership not found", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({
      id: USER_ID,
      email: "coord@test.com",
    } as any);
    vi.mocked(supabaseAdmin.from).mockImplementation(
      () =>
        makeSelectChain({
          data: null,
          error: { message: "not found" },
        }) as any,
    );
    const req = makeRequest({ org_id: ORG_ID, recipient_id: REC_ID });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns PDF for coordinator", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({
      id: USER_ID,
      email: "coord@test.com",
    } as any);
    vi.mocked(supabaseAdmin.from).mockImplementation(
      () =>
        makeSelectChain({
          data: { role: "coordinator", accepted_at: "2024-01-01T00:00:00Z" },
          error: null,
        }) as any,
    );
    vi.mocked(buildHistoryExport).mockResolvedValue(mockSnapshot as any);

    const req = makeRequest({ org_id: ORG_ID, recipient_id: REC_ID });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(".pdf");
  });

  it("returns 500 on buildHistoryExport failure", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({
      id: USER_ID,
      email: "coord@test.com",
    } as any);
    vi.mocked(supabaseAdmin.from).mockImplementation(
      () =>
        makeSelectChain({
          data: { role: "coordinator", accepted_at: "2024-01-01T00:00:00Z" },
          error: null,
        }) as any,
    );
    vi.mocked(buildHistoryExport).mockRejectedValue(
      new Error("Recipient not found"),
    );

    const req = makeRequest({ org_id: ORG_ID, recipient_id: REC_ID });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
