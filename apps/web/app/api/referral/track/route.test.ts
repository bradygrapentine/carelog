// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: vi.fn().mockReturnValue({ capture: vi.fn() }),
}));

import { getRequestUser } from "@/lib/supabaseServer";
import { getPostHogClient } from "@/lib/posthog-server";
import { POST } from "./route";

const USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const ORG_ID = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/referral/track", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/referral/track", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValueOnce(null);
    const res = await POST(postRequest({ orgId: ORG_ID }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when orgId is missing", async () => {
    vi.mocked(getRequestUser).mockResolvedValueOnce({ id: USER_ID } as never);
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when orgId is not a string", async () => {
    vi.mocked(getRequestUser).mockResolvedValueOnce({ id: USER_ID } as never);
    const res = await POST(postRequest({ orgId: 42 }));
    expect(res.status).toBe(400);
  });

  it("captures referral_shared event with org_id UUID (PHI rule)", async () => {
    vi.mocked(getRequestUser).mockResolvedValueOnce({ id: USER_ID } as never);
    const mockCapture = vi.fn();
    vi.mocked(getPostHogClient).mockReturnValueOnce({
      capture: mockCapture,
    } as never);

    const res = await POST(postRequest({ orgId: ORG_ID }));

    expect(res.status).toBe(200);
    expect(mockCapture).toHaveBeenCalledOnce();
    const call = mockCapture.mock.calls[0][0];
    expect(call.event).toBe("referral_shared");
    expect(call.distinctId).toBe(USER_ID);
    expect(call.properties).toEqual({ org_id: ORG_ID });
  });

  it("does NOT include email or name in event properties (PHI rule)", async () => {
    vi.mocked(getRequestUser).mockResolvedValueOnce({ id: USER_ID } as never);
    const mockCapture = vi.fn();
    vi.mocked(getPostHogClient).mockReturnValueOnce({
      capture: mockCapture,
    } as never);

    await POST(postRequest({ orgId: ORG_ID }));

    const props = mockCapture.mock.calls[0][0].properties;
    expect(props).not.toHaveProperty("email");
    expect(props).not.toHaveProperty("name");
    expect(props).not.toHaveProperty("orgName");
  });

  it("returns 200 even if PostHog throws (analytics non-critical)", async () => {
    vi.mocked(getRequestUser).mockResolvedValueOnce({ id: USER_ID } as never);
    vi.mocked(getPostHogClient).mockImplementationOnce(() => {
      throw new Error("PostHog down");
    });

    const res = await POST(postRequest({ orgId: ORG_ID }));
    expect(res.status).toBe(200);
  });
});
