// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

vi.mock("@/server/repositories/organizationsRepository", () => ({
  createOrganization: vi.fn(),
}));

vi.mock("@/server/repositories/identityRepository", () => ({
  createIdentity: vi.fn(),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn().mockReturnValue({ capture: vi.fn() }),
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { createOrganization } from "@/server/repositories/organizationsRepository";
import { createIdentity } from "@/server/repositories/identityRepository";
import { POST } from "./route";

const USER_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const ORG_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const IDENTITY_TOKEN = "identity-token-abc";

const VALID_BODY = {
  recipientName: "Jane Doe",
  orgName: "Doe Family",
};

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/onboarding/create", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeInsertChain(result: object) {
  const chain: Record<string, unknown> = {};
  const methods = ["insert", "update", "select", "eq"] as const;
  for (const m of methods) chain[m] = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  (chain as any).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(getRequestUser).mockResolvedValue({
    id: USER_ID,
    email: "user@example.com",
  } as any);
  vi.mocked(createOrganization).mockResolvedValue({ id: ORG_ID } as any);
  vi.mocked(createIdentity).mockResolvedValue(IDENTITY_TOKEN);
});

describe("POST /api/onboarding/create", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null as any);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/);
  });

  it("returns 400 when recipientName is missing", async () => {
    const res = await POST(postRequest({ orgName: "Family" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when orgName is missing", async () => {
    const res = await POST(postRequest({ recipientName: "Jane" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when care_recipients insert fails", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeInsertChain({
          data: null,
          error: { message: "insert failed" },
        }) as any,
    );

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/care recipient/);
  });

  it("returns 200 { success: true, orgId } on happy path", async () => {
    vi.mocked(supabaseAdmin.from)
      // care_recipients insert
      .mockImplementationOnce(
        () =>
          makeInsertChain({
            data: { id: "recipient-id" },
            error: null,
          }) as any,
      )
      // memberships insert
      .mockImplementationOnce(
        () => makeInsertChain({ data: null, error: null }) as any,
      )
      // user_profiles update
      .mockImplementationOnce(
        () => makeInsertChain({ data: null, error: null }) as any,
      );

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.orgId).toBe(ORG_ID);
  });
});
