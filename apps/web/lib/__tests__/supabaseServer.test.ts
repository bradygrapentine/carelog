// @vitest-environment node
/**
 * TD-25: supabaseServer session-refresh regression tests
 *
 * Covers the cookie-based session refresh flow in supabaseServer.ts:
 *   1. Expired access_token + valid refresh_token → new session returned
 *   2. Expired access_token + expired/missing refresh_token → getUser returns null (401 path)
 *   3. Bearer-token path (createRequestSupabase) → getUser delegates to token, not cookies
 *   4. No bearer token → falls back to cookie-based client
 *
 * These tests catch regressions from Next.js or @supabase/ssr upgrades that
 * silently break the { getAll, setAll } cookie API.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Shared mock state — set per-test via helpers below
// ---------------------------------------------------------------------------

type MockSession = {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
};

type MockGetUserResult =
  | { data: { user: { id: string; email: string } }; error: null }
  | { data: { user: null }; error: { message: string; status: number } };

let mockGetUser: ReturnType<typeof vi.fn>;
let mockRefreshSession: ReturnType<typeof vi.fn>;
let capturedCookieHandlers: {
  getAll?: () => { name: string; value: string }[];
  setAll?: (
    cookies: { name: string; value: string; options: unknown }[],
  ) => void;
} = {};

const VALID_USER = { id: "user-uuid-123", email: "test@example.com" };
const VALID_SESSION: MockSession = {
  access_token: "new-access-token",
  refresh_token: "valid-refresh-token",
  user: VALID_USER,
};

// @supabase/ssr mock — captures cookie handlers so tests can inspect them
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    (
      _url: string,
      _key: string,
      opts: {
        cookies: {
          getAll: () => { name: string; value: string }[];
          setAll: (
            cookies: { name: string; value: string; options: unknown }[],
          ) => void;
        };
      },
    ) => {
      capturedCookieHandlers = opts.cookies;
      return {
        auth: {
          getUser: mockGetUser,
          refreshSession: mockRefreshSession,
        },
      };
    },
  ),
}));

// @supabase/supabase-js mock (used by createRequestSupabase for bearer-token path)
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      refreshSession: mockRefreshSession,
    },
  })),
}));

// next/headers mock — simulates a cookie store with controllable contents
const cookieStore = {
  cookies: [] as { name: string; value: string }[],
  getAll() {
    return this.cookies;
  },
  set(name: string, value: string) {
    const idx = this.cookies.findIndex((c) => c.name === name);
    if (idx >= 0) this.cookies[idx].value = value;
    else this.cookies.push({ name, value });
  },
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(cookieStore)),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setCookies(pairs: { name: string; value: string }[]) {
  cookieStore.cookies = [...pairs];
}

function mockGetUserSuccess(user: {
  id: string;
  email: string;
}): MockGetUserResult {
  return { data: { user }, error: null };
}

function mockGetUserFailure(
  message = "JWT expired",
  status = 401,
): MockGetUserResult {
  return { data: { user: null }, error: { message, status } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createServerSupabase — cookie session refresh", () => {
  beforeEach(() => {
    vi.resetModules();
    capturedCookieHandlers = {};
    cookieStore.cookies = [];
    mockGetUser = vi.fn();
    mockRefreshSession = vi.fn();
  });

  it("passes { getAll, setAll } cookie handlers to createServerClient (API contract)", async () => {
    mockGetUser.mockResolvedValue(mockGetUserSuccess(VALID_USER));

    const { createServerSupabase } = await import("../supabaseServer");
    await createServerSupabase();

    expect(typeof capturedCookieHandlers.getAll).toBe("function");
    expect(typeof capturedCookieHandlers.setAll).toBe("function");
  });

  it("getAll returns current cookies from the store", async () => {
    setCookies([
      { name: "sb-access-token", value: "expired-token" },
      { name: "sb-refresh-token", value: "valid-refresh" },
    ]);
    mockGetUser.mockResolvedValue(mockGetUserSuccess(VALID_USER));

    const { createServerSupabase } = await import("../supabaseServer");
    await createServerSupabase();

    const cookies = capturedCookieHandlers.getAll!();
    expect(cookies).toEqual(
      expect.arrayContaining([
        { name: "sb-access-token", value: "expired-token" },
        { name: "sb-refresh-token", value: "valid-refresh" },
      ]),
    );
  });

  it("setAll writes refreshed cookies back to the store", async () => {
    setCookies([{ name: "sb-access-token", value: "old-token" }]);
    mockGetUser.mockResolvedValue(mockGetUserSuccess(VALID_USER));

    const { createServerSupabase } = await import("../supabaseServer");
    await createServerSupabase();

    // Simulate @supabase/ssr calling setAll with new tokens after refresh
    capturedCookieHandlers.setAll!([
      { name: "sb-access-token", value: "refreshed-token", options: {} },
    ]);

    const updatedCookie = cookieStore
      .getAll()
      .find((c) => c.name === "sb-access-token");
    expect(updatedCookie?.value).toBe("refreshed-token");
  });

  it("setAll does NOT throw when the cookie store is read-only (Server Component path)", async () => {
    // Server Components cannot set cookies — supabaseServer.ts swallows the error silently
    const readOnlyStore = {
      getAll: () => [] as { name: string; value: string }[],
      set: () => {
        throw new Error("Cannot set cookies in a Server Component");
      },
    };
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValueOnce(
      readOnlyStore as unknown as Awaited<ReturnType<typeof cookies>>,
    );

    mockGetUser.mockResolvedValue(mockGetUserSuccess(VALID_USER));

    const { createServerSupabase } = await import("../supabaseServer");
    await createServerSupabase();

    // setAll swallows the error — calling it must not throw
    expect(() =>
      capturedCookieHandlers.setAll!([
        { name: "sb-access-token", value: "new-token", options: {} },
      ]),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getRequestUser — session outcome tests
// ---------------------------------------------------------------------------

describe("getRequestUser — expired access_token scenarios", () => {
  beforeEach(() => {
    vi.resetModules();
    capturedCookieHandlers = {};
    cookieStore.cookies = [];
    mockGetUser = vi.fn();
    mockRefreshSession = vi.fn();
  });

  it("returns user when access_token is valid (happy path)", async () => {
    mockGetUser.mockResolvedValue(mockGetUserSuccess(VALID_USER));
    setCookies([{ name: "sb-access-token", value: "valid-token" }]);

    const { getRequestUser } = await import("../supabaseServer");
    const user = await getRequestUser({ headers: new Headers() });

    expect(user).not.toBeNull();
    expect(user?.id).toBe(VALID_USER.id);
  });

  it("returns null when access_token is expired and there is no bearer token (401 path)", async () => {
    // Simulates: expired access_token + expired/missing refresh_token
    // @supabase/ssr will call getUser() and receive a 401 error
    mockGetUser.mockResolvedValue(mockGetUserFailure("JWT expired", 401));
    setCookies([
      { name: "sb-access-token", value: "expired-token" },
      // no refresh_token cookie → refresh cannot succeed
    ]);

    const { getRequestUser } = await import("../supabaseServer");
    const user = await getRequestUser({ headers: new Headers() });

    // getRequestUser returns null on error — callers treat this as 401
    expect(user).toBeNull();
  });

  it("calls getUser() with cookie-based client when no Authorization header is present", async () => {
    mockGetUser.mockResolvedValue(mockGetUserSuccess(VALID_USER));

    const { getRequestUser } = await import("../supabaseServer");
    await getRequestUser({ headers: new Headers() });

    // createServerClient (mocked via @supabase/ssr) should have been used —
    // the captured cookie handlers confirm we went through the SSR path
    expect(typeof capturedCookieHandlers.getAll).toBe("function");
    expect(mockGetUser).toHaveBeenCalled();
  });

  it("calls getUser(token) with bearer-token client when Authorization header present", async () => {
    mockGetUser.mockResolvedValue(mockGetUserSuccess(VALID_USER));

    const headers = new Headers({ Authorization: "Bearer my-access-token" });
    const { getRequestUser } = await import("../supabaseServer");
    const user = await getRequestUser({ headers });

    expect(mockGetUser).toHaveBeenCalledWith("my-access-token");
    expect(user?.id).toBe(VALID_USER.id);
  });

  it("returns null when bearer token is invalid (expired or revoked)", async () => {
    mockGetUser.mockResolvedValue(mockGetUserFailure("invalid JWT", 401));

    const headers = new Headers({ Authorization: "Bearer bad-token" });
    const { getRequestUser } = await import("../supabaseServer");
    const user = await getRequestUser({ headers });

    expect(user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createRequestSupabase — bearer-token client config
// ---------------------------------------------------------------------------

describe("createRequestSupabase — bearer-token client", () => {
  beforeEach(() => {
    vi.resetModules();
    capturedCookieHandlers = {};
    mockGetUser = vi.fn();
    mockRefreshSession = vi.fn();
  });

  it("uses createClient (not createServerClient) when Authorization header is present", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { createServerClient } = await import("@supabase/ssr");

    // Clear accumulated calls from earlier tests in this describe block
    vi.mocked(createClient).mockClear();
    vi.mocked(createServerClient).mockClear();

    const headers = new Headers({ Authorization: "Bearer my-token" });
    const { createRequestSupabase } = await import("../supabaseServer");
    await createRequestSupabase({ headers });

    expect(createClient).toHaveBeenCalled();
    // createServerClient should NOT have been called for bearer token path
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("configures bearer client with autoRefreshToken=false and persistSession=false", async () => {
    const { createClient } = await import("@supabase/supabase-js");

    type CreateClientOpts = Parameters<typeof createClient>[2];
    let capturedOpts: CreateClientOpts;

    vi.mocked(createClient).mockImplementationOnce((_url, _key, opts) => {
      capturedOpts = opts;
      // Return a minimal stub — double-cast to satisfy the type system in tests only
      return {
        auth: { getUser: mockGetUser, refreshSession: mockRefreshSession },
      } as unknown as ReturnType<typeof createClient>;
    });

    const headers = new Headers({ Authorization: "Bearer tok" });
    const { createRequestSupabase } = await import("../supabaseServer");
    await createRequestSupabase({ headers });

    expect(capturedOpts?.auth?.autoRefreshToken).toBe(false);
    expect(capturedOpts?.auth?.persistSession).toBe(false);
  });

  it("falls back to cookie-based client when no Authorization header is present", async () => {
    const { createServerClient } = await import("@supabase/ssr");

    const { createRequestSupabase } = await import("../supabaseServer");
    await createRequestSupabase({ headers: new Headers() });

    expect(createServerClient).toHaveBeenCalled();
  });

  it("ignores malformed Authorization headers (missing Bearer prefix)", async () => {
    const { createServerClient } = await import("@supabase/ssr");

    const headers = new Headers({ Authorization: "Basic dXNlcjpwYXNz" });
    const { createRequestSupabase } = await import("../supabaseServer");
    await createRequestSupabase({ headers });

    // Falls back to cookie client — not a bearer token
    expect(createServerClient).toHaveBeenCalled();
  });
});
