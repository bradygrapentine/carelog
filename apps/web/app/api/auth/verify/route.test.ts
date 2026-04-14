// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

import { createServerClient } from "@supabase/ssr";
import { POST } from "./route";

const mockVerifyOtp = vi.fn();

function makeSupabaseMock() {
  return {
    auth: {
      verifyOtp: mockVerifyOtp,
    },
  };
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/verify", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.mocked(createServerClient).mockReturnValue(makeSupabaseMock() as any);
  mockVerifyOtp.mockReset();
});

describe("POST /api/auth/verify", () => {
  it("returns 400 when email is missing", async () => {
    const res = await POST(postRequest({ token: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is not 6 characters", async () => {
    const res = await POST(
      postRequest({ email: "user@example.com", token: "12345" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when OTP verification fails", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {},
      error: { message: "Token has expired" },
    });

    const res = await POST(
      postRequest({ email: "user@example.com", token: "123456" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Token has expired");
  });

  it("returns 400 when OTP succeeds but no session returned", async () => {
    mockVerifyOtp.mockResolvedValue({ data: { session: null }, error: null });

    const res = await POST(
      postRequest({ email: "user@example.com", token: "123456" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No session");
  });

  it("returns 200 { success: true } on valid OTP", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: { access_token: "tok" } },
      error: null,
    });

    const res = await POST(
      postRequest({ email: "user@example.com", token: "123456" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 400 when email is not a valid address", async () => {
    const res = await POST(
      postRequest({ email: "not-an-email", token: "123456" }),
    );
    expect(res.status).toBe(400);
  });
});
