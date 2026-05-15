import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({
  getRequestUser: vi.fn(),
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";

const VALID_UUID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const VALID_ORG_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const VALID_JOB_ID = "cccccccc-dddd-eeee-ffff-000000000000";
const VALID_REC_ID = "dddddddd-eeee-ffff-0000-111111111111";

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

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(getRequestUser).mockResolvedValue({ id: VALID_UUID } as any);
});

describe("POST /api/ocr/confirm", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null as any);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Unauthorized/);
  });

  it("returns 400 when jobId is not a UUID", async () => {
    const res = await POST(postRequest({ ...VALID_BODY, jobId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid request body/);
  });

  it("returns 403 when caller is not a coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({ data: { role: "caregiver" }, error: null }) as any,
    );

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Forbidden/);
  });

  it("returns 404 when job not found", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: { role: "coordinator" },
            error: null,
          }) as any,
      )
      .mockImplementationOnce(
        () => makeSelectChain({ data: null, error: null }) as any,
      );

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Job not found/);
  });

  it("returns 200 { ok: true } on success", async () => {
    vi.mocked(supabaseAdmin.from)
      // membership check
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: { role: "coordinator" },
            error: null,
          }) as any,
      )
      // job lookup — recipient_id + status + raw_text come from the row, never from client body
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: {
              id: VALID_JOB_ID,
              recipient_id: VALID_REC_ID,
              status: "needs_review",
              raw_text: "Metformin 500mg twice daily",
            },
            error: null,
          }) as any,
      )
      // SEC-007: audit log insert
      .mockImplementationOnce(
        () => makeSelectChain({ data: null, error: null }) as any,
      )
      // medication insert
      .mockImplementationOnce(
        () => makeSelectChain({ data: null, error: null }) as any,
      )
      // ocr_jobs update — optimistic lock: count: 1 indicates row was updated
      .mockImplementationOnce(
        () =>
          makeSelectChain({ data: null, error: null, count: 1 } as any) as any,
      );

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("SEC-007: returns 500 when audit insert fails AND does not insert medication", async () => {
    const medInsertSpy = vi.fn(() =>
      makeSelectChain({ data: null, error: null }),
    );

    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: { role: "coordinator" },
            error: null,
          }) as any,
      )
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: {
              id: VALID_JOB_ID,
              recipient_id: VALID_REC_ID,
              status: "needs_review",
              raw_text: "Metformin 500mg twice daily",
            },
            error: null,
          }) as any,
      )
      // Audit insert FAILS — fail-loud, no swallow
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: null,
            error: { message: "audit table down" },
          }) as any,
      )
      // medication-insert mock — should NOT be called
      .mockImplementationOnce(medInsertSpy as any);

    const res = await POST(postRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/audit table down/);
    // Medication insert must NOT have been reached
    expect(medInsertSpy).not.toHaveBeenCalled();
  });

  it("SEC-007: audit insert payload has SHA-256 hash + only confirmed field keys", async () => {
    const auditInsertSpy = vi.fn((payload: unknown) => {
      // Capture audit payload via insert(...) call shape
      return makeSelectChain({ data: null, error: null });
    });

    const auditFrom = () => ({
      insert: auditInsertSpy,
      select: () => ({}),
      eq: () => ({}),
    });

    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: { role: "coordinator" },
            error: null,
          }) as any,
      )
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: {
              id: VALID_JOB_ID,
              recipient_id: VALID_REC_ID,
              status: "needs_review",
              raw_text: "Metformin 500mg",
            },
            error: null,
          }) as any,
      )
      .mockImplementationOnce(auditFrom as any)
      .mockImplementationOnce(
        () => makeSelectChain({ data: null, error: null }) as any,
      )
      .mockImplementationOnce(
        () =>
          makeSelectChain({ data: null, error: null, count: 1 } as any) as any,
      );

    await POST(postRequest({ ...VALID_BODY, instructions: "with food" }));

    expect(auditInsertSpy).toHaveBeenCalledTimes(1);
    const payload = auditInsertSpy.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(payload).toBeDefined();
    expect(payload.ocr_job_id).toBe(VALID_JOB_ID);
    expect(payload.org_id_snapshot).toBe(VALID_ORG_ID);
    expect(payload.user_id).toBe(VALID_UUID);
    expect(payload.confirmed_field_keys).toEqual([
      "drug_name",
      "dosage",
      "instructions",
    ]);
    expect(payload.field_count).toBe(3);
    // SHA-256 of "Metformin 500mg" NFC-normalized — verify it's a Buffer of length 32
    expect(Buffer.isBuffer(payload.raw_output_hash)).toBe(true);
    expect((payload.raw_output_hash as Buffer).length).toBe(32);
  });
});
