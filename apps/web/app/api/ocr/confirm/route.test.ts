import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
  wrapAdminError: vi.fn((e: unknown) =>
    e instanceof Error
      ? e
      : new Error(String((e as { message?: string })?.message ?? e)),
  ),
}));

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { POST } from "./route";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import * as Sentry from "@sentry/nextjs";

const VALID_UUID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const VALID_ORG_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const VALID_JOB_ID = "cccccccc-dddd-eeee-ffff-000000000000";

const VALID_BODY = {
  jobId: VALID_JOB_ID,
  orgId: VALID_ORG_ID,
  drug_name: "Metformin",
  dosage: "500mg",
};

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.insert = () => chain;
  chain.update = () => chain;
  chain.eq = () => chain;
  chain.not = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/ocr/confirm", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// Sets up the membership + job lookup chain (the two `from(...)` calls before
// the RPC). Returns the rpc mock for the test to control its return shape.
function mockHappyPathBeforeRpc(opts?: {
  jobStatus?: string;
  rawText?: string;
}) {
  vi.mocked(supabaseAdmin.from)
    .mockImplementationOnce(
      () =>
        makeSelectChain({
          data: { role: "coordinator" },
          error: null,
        }) as never,
    )
    .mockImplementationOnce(
      () =>
        makeSelectChain({
          data: {
            id: VALID_JOB_ID,
            raw_text: opts?.rawText ?? "Metformin 500mg twice daily",
          },
          error: null,
        }) as never,
    );
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(supabaseAdmin.rpc).mockReset();
  vi.mocked(getRequestUser).mockResolvedValue({ id: VALID_UUID } as never);
  vi.mocked(Sentry.captureException).mockReset();
});

describe("POST /api/ocr/confirm", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null as never);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/Unauthorized/);
  });

  it("returns 400 when jobId is not a UUID", async () => {
    const res = await POST(postRequest({ ...VALID_BODY, jobId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid request body/);
  });

  it("returns 403 when caller is not a coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: { role: "caregiver" },
          error: null,
        }) as never,
    );

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/Forbidden/);
  });

  it("returns 404 when pre-RPC job lookup misses", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: { role: "coordinator" },
            error: null,
          }) as never,
      )
      .mockImplementationOnce(
        () => makeSelectChain({ data: null, error: null }) as never,
      );

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/Job not found/);
  });

  it("returns 200 { ok: true } on RPC success", async () => {
    mockHappyPathBeforeRpc();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: true, error: null },
      error: null,
    } as never);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("RPC sentinel 'org_mismatch' → 403 with generic message + raw error NOT echoed", async () => {
    mockHappyPathBeforeRpc();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "org_mismatch" },
      error: null,
    } as never);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Forbidden");
  });

  it("RPC sentinel 'not_pending' → 400", async () => {
    mockHappyPathBeforeRpc();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "not_pending" },
      error: null,
    } as never);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid transition/);
  });

  it("RPC sentinel 'already_confirmed' → 409 (race-loser path)", async () => {
    mockHappyPathBeforeRpc();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "already_confirmed" },
      error: null,
    } as never);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already confirmed/);
  });

  it("RPC sentinel 'not_found' → 404", async () => {
    mockHappyPathBeforeRpc();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "not_found" },
      error: null,
    } as never);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/Job not found/);
  });

  it("RPC transport error → 500 generic + Sentry captured (TD-167 pattern)", async () => {
    mockHappyPathBeforeRpc();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: { message: "connection refused", code: "08006" },
    } as never);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to confirm OCR job");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const tags = vi.mocked(Sentry.captureException).mock.calls[0]?.[1] as {
      tags: { component: string; path: string };
    };
    expect(tags?.tags.path).toBe("rpc.error");
  });

  it("Unknown sentinel falls through to 500 + Sentry capture", async () => {
    mockHappyPathBeforeRpc();
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: false, error: "made_up_sentinel" },
      error: null,
    } as never);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to confirm OCR job");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const tags = vi.mocked(Sentry.captureException).mock.calls[0]?.[1] as {
      tags: { component: string; path: string };
    };
    expect(tags?.tags.path).toBe("rpc.fallthrough");
  });

  it("RPC payload includes correctly built confirmed_field_keys + raw_output_hash buffer", async () => {
    mockHappyPathBeforeRpc({ rawText: "Metformin 500mg" });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: { success: true, error: null },
      error: null,
    } as never);

    await POST(postRequest({ ...VALID_BODY, instructions: "with food" }));

    expect(supabaseAdmin.rpc).toHaveBeenCalledTimes(1);
    const [fnName, args] = vi.mocked(supabaseAdmin.rpc).mock.calls[0] ?? [];
    expect(fnName).toBe("confirm_ocr_job");
    const payload = args as {
      p_user_id: string;
      p_org_id: string;
      p_job_id: string;
      p_drug_name: string;
      p_dosage: string;
      p_instructions: string;
      p_raw_output_hash: Buffer;
      p_confirmed_field_keys: string[];
    };
    expect(payload.p_user_id).toBe(VALID_UUID);
    expect(payload.p_org_id).toBe(VALID_ORG_ID);
    expect(payload.p_job_id).toBe(VALID_JOB_ID);
    expect(payload.p_drug_name).toBe("Metformin");
    expect(payload.p_dosage).toBe("500mg");
    expect(payload.p_instructions).toBe("with food");
    expect(payload.p_confirmed_field_keys).toEqual([
      "drug_name",
      "dosage",
      "instructions",
    ]);
    expect(Buffer.isBuffer(payload.p_raw_output_hash)).toBe(true);
    expect(payload.p_raw_output_hash.length).toBe(32);
  });
});
