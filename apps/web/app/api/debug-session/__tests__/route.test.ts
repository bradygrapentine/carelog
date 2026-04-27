/**
 * Tests for apps/web/app/api/debug-session/route.ts
 *
 * Coverage goals:
 * - Returns 404 when NODE_ENV is not 'development' (production guard)
 * - Returns 200 with session info in development mode
 */

import { describe, it, expect, vi, afterEach } from "vitest";

const mockGetUser = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockReturnValue({
    getAll: vi.fn().mockReturnValue([{ name: "sb-token" }]),
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}));

describe("GET /api/debug-session", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    mockGetUser.mockReset();
  });

  it("returns 404 when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("returns 200 with session data when NODE_ENV is development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    mockGetUser.mockResolvedValue({
      data: { user: { email: "dev@example.com" } },
      error: null,
    });

    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("cookies");
    expect(body).toHaveProperty("user");
  });
});
