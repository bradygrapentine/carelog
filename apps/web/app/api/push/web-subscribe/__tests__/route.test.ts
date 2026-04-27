/**
 * Tests for apps/web/app/api/push/web-subscribe/route.ts
 *
 * Coverage goals:
 * - POST 401 when unauthenticated
 * - POST 400 when subscription payload is invalid
 * - POST 200 on valid subscription (upserts with dedup)
 * - DELETE 401 when unauthenticated
 * - DELETE 400 when endpoint is missing
 * - DELETE 200 on valid delete (scoped to user)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { POST, DELETE } from "../route";
import { getRequestUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const USER_ID = "aaaa0001-0000-0000-0000-000000000001";

// Fake fixture values — the route doesn't validate the shape of `keys`,
// only that both fields are present. Kept low-entropy on purpose so the
// gitleaks `generic-api-key` rule doesn't flag them as secrets.
const VALID_SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    p256dh: "fake-p256dh-public-key",
    auth: "fake-auth-secret",
  },
};

function makeRequest(method: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/push/web-subscribe", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(getRequestUser).mockReset();
  vi.mocked(supabaseAdmin.from).mockReset();
});

// ── POST ──────────────────────────────────────────────────────────────────────

describe("POST /api/push/web-subscribe", () => {
  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null);

    const res = await POST(makeRequest("POST", VALID_SUBSCRIPTION));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/i);
  });

  it("returns 400 when endpoint is missing", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const res = await POST(
      makeRequest("POST", { keys: VALID_SUBSCRIPTION.keys }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid subscription/i);
  });

  it("returns 400 when p256dh key is missing", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const res = await POST(
      makeRequest("POST", {
        endpoint: VALID_SUBSCRIPTION.endpoint,
        keys: { auth: VALID_SUBSCRIPTION.keys.auth },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when auth key is missing", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const res = await POST(
      makeRequest("POST", {
        endpoint: VALID_SUBSCRIPTION.endpoint,
        keys: { p256dh: VALID_SUBSCRIPTION.keys.p256dh },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 on valid subscription upsert", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    const res = await POST(makeRequest("POST", VALID_SUBSCRIPTION));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("upserts with onConflict on endpoint to deduplicate", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      upsert: upsertMock,
    } as any);

    await POST(makeRequest("POST", VALID_SUBSCRIPTION));
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        auth_user_id: USER_ID,
        endpoint: VALID_SUBSCRIPTION.endpoint,
        p256dh_key: VALID_SUBSCRIPTION.keys.p256dh,
        auth_key: VALID_SUBSCRIPTION.keys.auth,
      }),
      expect.objectContaining({ onConflict: "endpoint" }),
    );
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/push/web-subscribe", () => {
  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null);

    const res = await DELETE(
      makeRequest("DELETE", { endpoint: VALID_SUBSCRIPTION.endpoint }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when endpoint is missing", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const res = await DELETE(makeRequest("DELETE", {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing endpoint/i);
  });

  it("returns 200 on valid delete", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const chain: Record<string, unknown> = {};
    chain.delete = () => chain;
    chain.eq = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ error: null }).then(resolve);
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any);

    const res = await DELETE(
      makeRequest("DELETE", { endpoint: VALID_SUBSCRIPTION.endpoint }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("scopes delete to authenticated user endpoint only", async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any);

    const eqMock = vi.fn().mockReturnThis();
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      delete: deleteMock,
    } as any);

    await DELETE(
      makeRequest("DELETE", { endpoint: VALID_SUBSCRIPTION.endpoint }),
    );

    expect(eqMock).toHaveBeenCalledWith("auth_user_id", USER_ID);
    expect(eqMock).toHaveBeenCalledWith(
      "endpoint",
      VALID_SUBSCRIPTION.endpoint,
    );
  });
});
