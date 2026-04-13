// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Mock @supabase/ssr so we can assert our proxy invokes getUser() on the
// server client. This is the single load-bearing call that refreshes the
// session cookie on every request — if it is ever removed, the layout's
// server-side auth check silently fails and users bounce back to /signin.
const getUser = vi
  .fn()
  .mockResolvedValue({ data: { user: null }, error: null });

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser },
  })),
}));

describe("proxy middleware", () => {
  it("exports a `proxy` function and a matcher config", async () => {
    const mod = await import("../../proxy");
    expect(typeof mod.proxy).toBe("function");
    expect(mod.config?.matcher).toBeTruthy();
  });

  it("calls supabase.auth.getUser() so sessions are refreshed per request", async () => {
    const { proxy } = await import("../../proxy");

    const request = {
      cookies: {
        getAll: () => [],
        set: vi.fn(),
      },
    } as unknown as NextRequest;

    await proxy(request);

    expect(getUser).toHaveBeenCalled();
  });
});
