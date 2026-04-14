// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { GET } from "./route";

const TOKEN = "abc123token";
const MEMBERSHIP_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function getRequest() {
  return new NextRequest(`http://localhost/api/invite/${TOKEN}`);
}

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) };
}

function makeSelectChain(result: object) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq"] as const;
  for (const m of methods) chain[m] = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

describe("GET /api/invite/[token]", () => {
  it("returns 404 when invite not found", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({ data: null, error: { message: "not found" } }) as any,
    );

    const res = await GET(getRequest(), makeParams(TOKEN));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 410 when invite has already been consumed", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: {
            id: "inv-1",
            email: "a@b.com",
            consumed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10000).toISOString(),
            membership_id: MEMBERSHIP_ID,
          },
          error: null,
        }) as any,
    );

    const res = await GET(getRequest(), makeParams(TOKEN));
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/already been used/);
  });

  it("returns 410 when invite has expired", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: {
            id: "inv-1",
            email: "a@b.com",
            consumed_at: null,
            expires_at: new Date(Date.now() - 10000).toISOString(),
            membership_id: MEMBERSHIP_ID,
          },
          error: null,
        }) as any,
    );

    const res = await GET(getRequest(), makeParams(TOKEN));
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/expired/);
  });

  it("returns 200 with email, role, orgName on valid invite", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: {
              id: "inv-1",
              email: "invitee@example.com",
              consumed_at: null,
              expires_at: new Date(
                Date.now() + 48 * 60 * 60 * 1000,
              ).toISOString(),
              membership_id: MEMBERSHIP_ID,
            },
            error: null,
          }) as any,
      )
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: {
              role: "caregiver",
              org_id: "org-1",
              organizations: { name: "Smith Family" },
            },
            error: null,
          }) as any,
      );

    const res = await GET(getRequest(), makeParams(TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe("invitee@example.com");
    expect(body.role).toBe("caregiver");
    expect(body.orgName).toBe("Smith Family");
  });
});
