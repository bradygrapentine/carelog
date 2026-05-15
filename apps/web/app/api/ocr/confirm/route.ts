import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";
import { getPostHogClient } from "@/lib/posthog-server";
import {
  OcrJobStateMachine,
  OcrTransitionError,
  type OcrStatus,
} from "@/lib/ocr/jobStateMachine";

const confirmSchema = z.object({
  jobId: z.string().uuid(),
  orgId: z.string().uuid(),
  drug_name: z.string().min(1),
  dosage: z.string().min(1),
  instructions: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, "ocr/confirm");
  if (limited) return limited;

  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { jobId, orgId, drug_name, dosage, instructions } = parsed.data;

    // Verify coordinator membership
    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .single();

    if (!membership || membership.role !== "coordinator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch job — read recipient_id and status from the row, never trust
    // client-supplied value. Widened to include raw_text for SEC-007 audit hash.
    const { data: job } = await supabaseAdmin
      .from("ocr_jobs")
      .select("id, recipient_id, status, raw_text")
      .eq("id", jobId)
      .eq("org_id", orgId)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Validate state transition via state machine
    const sm = new OcrJobStateMachine(job.status as OcrStatus);
    try {
      sm.transitionTo("confirmed");
    } catch (e) {
      if (e instanceof OcrTransitionError) {
        return NextResponse.json(
          { error: `Invalid transition: ${e.from} → ${e.to}` },
          { status: 400 },
        );
      }
      throw e;
    }

    // SEC-007: append-only audit log of the confirm attempt. PHI-free —
    // stores SHA-256 of raw_text + allowlist of confirmed field KEYS, never
    // the values themselves. Insert audit BEFORE medication so a failed audit
    // returns 500 and leaves ocr_jobs.status unchanged (idempotent retry).
    // Audit semantics: per-attempt (records 409-losers too — see TD-144).
    const raw_output_hash = createHash("sha256")
      .update((job.raw_text ?? "").normalize("NFC"), "utf8")
      .digest();
    const confirmed_field_keys = [
      typeof drug_name === "string" && drug_name.length > 0
        ? "drug_name"
        : null,
      typeof dosage === "string" && dosage.length > 0 ? "dosage" : null,
      typeof instructions === "string" && instructions.length > 0
        ? "instructions"
        : null,
    ].filter((k): k is string => k !== null);

    const { error: auditError } = await supabaseAdmin
      .from("ocr_audit_log")
      .insert({
        ocr_job_id: jobId,
        org_id_snapshot: orgId,
        user_id: user.id,
        raw_output_hash,
        confirmed_field_keys,
        field_count: confirmed_field_keys.length,
      });

    if (auditError) {
      // Audit failure must fail the request loudly (no swallow). T-06.
      return NextResponse.json({ error: auditError.message }, { status: 500 });
    }

    // Create medication row using recipient_id from the job (not from client body)
    const { error: medError } = await supabaseAdmin.from("medications").insert({
      org_id: orgId,
      recipient_id: job.recipient_id,
      drug_name,
      dosage,
      instructions: instructions ?? null,
      created_by: user.id,
    });

    if (medError) {
      return NextResponse.json({ error: medError.message }, { status: 500 });
    }

    // Mark job as confirmed — optimistic lock: only update if status hasn't changed
    const { error: updateError, count } = await supabaseAdmin
      .from("ocr_jobs")
      .update({ status: "confirmed" })
      .eq("id", jobId)
      .eq("status", job.status)
      .select("id");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!count || count === 0) {
      // Another concurrent request already changed the status — we lost the race
      return NextResponse.json(
        { error: "Conflict: job status changed concurrently" },
        { status: 409 },
      );
    }

    try {
      const posthog = getPostHogClient();
      const field_count = [drug_name, dosage, instructions].filter(
        (v) => typeof v === "string" && v.length > 0,
      ).length;
      posthog.capture({
        distinctId: user.id,
        event: "ocr_review_confirmed",
        properties: {
          org_id: orgId,
          document_id: jobId,
          field_count,
        },
      });
    } catch {
      // analytics failure must not break the endpoint
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const errorMessage =
      e instanceof Error ? e.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
