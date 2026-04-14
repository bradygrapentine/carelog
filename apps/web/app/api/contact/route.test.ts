import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCapture } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn(() => ({ capture: mockCapture })),
}));

vi.mock("../../../server/resend.server", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import { POST } from "./route";

// Rate limiter no-ops when UPSTASH env vars are absent (local dev).
// We still cover the rate-limit integration via the invoked code path.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
  mockCapture.mockClear();
});

function makeRequest(body: unknown, init?: RequestInit) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/contact", () => {
  it("returns 400 when name is missing", async () => {
    const req = makeRequest({ email: "a@b.com", message: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const req = makeRequest({ name: "Alex", message: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is missing", async () => {
    const req = makeRequest({ name: "Alex", email: "a@b.com" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is not a valid address", async () => {
    const req = makeRequest({
      name: "Alex",
      email: "not-an-email",
      message: "hello",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when fields exceed max lengths", async () => {
    const req = makeRequest({
      name: "A".repeat(200),
      email: "a@b.com",
      message: "hello",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 413 when body exceeds 16KB", async () => {
    const huge = "x".repeat(17 * 1024);
    const req = makeRequest({
      name: "Alex",
      email: "a@b.com",
      message: huge,
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it("returns 400 on invalid JSON", async () => {
    const req = makeRequest("not-json{");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 on valid submission", async () => {
    const req = makeRequest({
      name: "Alex",
      email: "a@b.com",
      message: "hello",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe("POST /api/contact — PostHog PHI boundary", () => {
  it('captures "contact_form_submitted" event on valid submission', async () => {
    const req = makeRequest({
      name: "Alex",
      email: "user@example.com",
      message: "hello",
    });
    await POST(req);
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({ event: "contact_form_submitted" }),
    );
  });

  it("distinctId is NOT the user email (must be a UUID)", async () => {
    const req = makeRequest({
      name: "Alex",
      email: "user@example.com",
      message: "hello",
    });
    await POST(req);
    const [call] = mockCapture.mock.calls;
    expect(call[0].distinctId).not.toBe("user@example.com");
    expect(call[0].distinctId).toMatch(UUID_RE);
  });

  it("capture properties do NOT contain the user email", async () => {
    const req = makeRequest({
      name: "Alex",
      email: "user@example.com",
      message: "hello",
    });
    await POST(req);
    const allArgs = JSON.stringify(mockCapture.mock.calls);
    expect(allArgs).not.toContain("user@example.com");
  });

  it("does NOT call posthog.capture when fields are invalid", async () => {
    const req = makeRequest({ name: "Alex", message: "hello" }); // missing email
    await POST(req);
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
