// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

vi.mock("@/server/resend.server", () => ({
  resend: {
    emails: { send: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn().mockReturnValue({ capture: vi.fn() }),
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { POST } from "./route";

const USER_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const ORG_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const MEMBERSHIP_ID = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
const VALID_TOKEN = "cccccccc-dddd-eeee-ffff-000000000000";

const VALID_BODY = {
  orgId: ORG_ID,
  recipientId: null,
  role: "caregiver",
  email: "invitee@example.com",
};

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/invite", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// Chain builder: supports select/insert/eq/not/is/gt/limit/single
function makeSelectChain(result: object) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "eq",
    "not",
    "is",
    "gt",
    "limit",
  ] as const;
  for (const m of methods) chain[m] = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  // For queries that don't use .single() (e.g. existingInvite check)
  (chain as any).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(getRequestUser).mockResolvedValue({
    id: USER_ID,
    email: "coordinator@example.com",
  } as any);
});

describe("POST /api/invite", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null as any);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/);
  });

  it("returns 400 when orgId is not a UUID", async () => {
    const res = await POST(postRequest({ ...VALID_BODY, orgId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when caller is not a coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({ data: { role: "caregiver" }, error: null }) as any,
    );

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/coordinator/);
  });

  it("returns 409 when a pending invite already exists for this email+org", async () => {
    // membership check → coordinator
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: { role: "coordinator" },
            error: null,
          }) as any,
      )
      // existingInvite check → one existing invite
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = {};
        const methods = ["select", "eq", "is", "gt", "limit"] as const;
        for (const m of methods) chain[m] = () => chain;
        (chain as any).then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: [{ id: "existing" }], error: null }).then(
            resolve,
          );
        return chain as any;
      });

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/pending/);
  });

  it("returns 200 { success: true, inviteUrl } on happy path", async () => {
    const noInviteChain: Record<string, unknown> = {};
    const noInviteMethods = ["select", "eq", "is", "gt", "limit"] as const;
    for (const m of noInviteMethods) noInviteChain[m] = () => noInviteChain;
    (noInviteChain as any).then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);

    vi.mocked(supabaseAdmin.from)
      // membership check
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: { role: "coordinator" },
            error: null,
          }) as any,
      )
      // existingInvite check
      .mockImplementationOnce(() => noInviteChain as any)
      // membership insert
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: { id: MEMBERSHIP_ID },
            error: null,
          }) as any,
      )
      // invite_tokens insert
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: { token: VALID_TOKEN },
            error: null,
          }) as any,
      );

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.inviteUrl).toContain(VALID_TOKEN);
  });
});
