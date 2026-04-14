// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { rpc: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn().mockReturnValue({ capture: vi.fn() }),
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { POST } from "./route";

const USER_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const TOKEN = "valid-invite-token-abc";

function postRequest() {
  return new NextRequest(`http://localhost/api/invite/${TOKEN}/accept`, {
    method: "POST",
  });
}

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) };
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.rpc).mockReset();
  vi.mocked(getRequestUser).mockResolvedValue({
    id: USER_ID,
    email: "user@example.com",
  } as any);
});

describe("POST /api/invite/[token]/accept", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null as any);

    const res = await POST(postRequest(), makeParams(TOKEN));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/);
  });

  it("returns 500 when RPC call fails with a DB error", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: "DB connection failed" },
    } as any);

    const res = await POST(postRequest(), makeParams(TOKEN));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB connection failed");
  });

  it("returns 403 when email does not match invite", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "email_mismatch" },
      error: null,
    } as any);

    const res = await POST(postRequest(), makeParams(TOKEN));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/different email/);
  });

  it("returns 404 when invite token is not found or expired", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "not_found" },
      error: null,
    } as any);

    const res = await POST(postRequest(), makeParams(TOKEN));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 410 when invite was already used", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "already_used" },
      error: null,
    } as any);

    const res = await POST(postRequest(), makeParams(TOKEN));
    expect(res.status).toBe(410);
  });

  it("returns 200 { success: true } on happy path", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    const res = await POST(postRequest(), makeParams(TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
