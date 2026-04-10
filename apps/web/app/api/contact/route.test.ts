import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("../../../server/resend.server", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

function makeRequest(body: Record<string, string>) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

  it("returns 200 on valid submission", async () => {
    const req = makeRequest({ name: "Alex", email: "a@b.com", message: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
