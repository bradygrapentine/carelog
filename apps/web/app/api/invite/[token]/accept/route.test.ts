// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { rpc: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn().mockReturnValue({ capture: vi.fn() }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
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

  it("returns 500 with generic message when RPC call fails (TD-167)", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: "DB connection failed" },
    } as any);

    const res = await POST(postRequest(), makeParams(TOKEN));
    expect(res.status).toBe(500);
    const body = await res.json();
    // TD-167: raw Postgres error message must NOT reach the client.
    expect(body.error).toBe("Internal error — please try again");
    expect(body.error).not.toMatch(/DB connection/);
    // Sentry capture invoked with the right tags
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(
      expect.objectContaining({ message: "DB connection failed" }),
      expect.objectContaining({
        tags: { component: "invite-accept", path: "rpc.error" },
      }),
    );
  });

  it("returns 500 with generic message when route throws (catch path, TD-167)", async () => {
    vi.mocked(supabaseAdmin.rpc).mockRejectedValue(
      new Error("unexpected runtime explosion"),
    );

    const res = await POST(postRequest(), makeParams(TOKEN));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal error — please try again");
    expect(body.error).not.toMatch(/unexpected runtime/);
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(
      expect.objectContaining({ message: "unexpected runtime explosion" }),
      expect.objectContaining({
        tags: { component: "invite-accept", path: "catch" },
      }),
    );
  });

  it("captures unknown sentinel error codes to Sentry (TD-167)", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "quota_exceeded" },
      error: null,
    } as any);

    const res = await POST(postRequest(), makeParams(TOKEN));
    expect(res.status).toBe(400);
    const body = await res.json();
    // Generic fallback — raw sentinel string must NOT reach the client.
    expect(body.error).toBe("Request could not be completed");
    expect(body.error).not.toMatch(/quota_exceeded/);
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          "Unknown invite sentinel: quota_exceeded",
        ),
      }),
      expect.objectContaining({
        tags: { component: "invite-accept", path: "sentinel.unknown" },
      }),
    );
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
