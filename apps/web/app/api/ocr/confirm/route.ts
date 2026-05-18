import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin, wrapAdminError } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";
import { getPostHogClient } from "@/lib/posthog-server";

const confirmSchema = z.object({
  jobId: z.string().uuid(),
  orgId: z.string().uuid(),
  drug_name: z.string().min(1),
  dosage: z.string().min(1),
  instructions: z.string().optional(),
});

// Sentinel → HTTP status + user-facing message. Raw sentinel kept server-side
// for Sentry breadcrumbs; never echoed to the client per TD-167/168.
const SENTINEL_MAP: Record<string, { status: number; message: string }> = {
  not_found: { status: 404, message: "Job not found" },
  org_mismatch: { status: 403, message: "Forbidden" },
  not_pending: { status: 400, message: "Invalid transition" },
  already_confirmed: { status: 409, message: "Job already confirmed" },
};

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

    // Coordinator membership check (unchanged from prior route — RPC is
    // service_role-gated but route still validates caller as defense in depth).
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

    // Pre-RPC read of raw_text to compute SHA-256 in JS (testable, no pgcrypto
    // dep). The RPC re-locks the row under FOR UPDATE so concurrency is safe;
    // raw_text is never updated post-insert on ocr_jobs (verified by grep).
    const { data: job } = await supabaseAdmin
      .from("ocr_jobs")
      .select("id, raw_text")
      .eq("id", jobId)
      .eq("org_id", orgId)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const raw_output_hash = createHash("sha256")
      .update((job.raw_text ?? "").normalize("NFC"), "utf8")
      .digest();
    const confirmed_field_keys = [
      drug_name.length > 0 ? "drug_name" : null,
      dosage.length > 0 ? "dosage" : null,
      typeof instructions === "string" && instructions.length > 0
        ? "instructions"
        : null,
    ].filter((k): k is string => k !== null);

    // TD-144: collapse audit + medication + status flip into one tx via RPC.
    // Eliminates the medication-duplication race the prior 3-statement
    // pattern allowed under concurrent confirms.
    const { data, error: rpcError } = await supabaseAdmin.rpc(
      "confirm_ocr_job",
      {
        p_user_id: user.id,
        p_org_id: orgId,
        p_job_id: jobId,
        p_drug_name: drug_name,
        p_dosage: dosage,
        p_instructions: instructions ?? "",
        p_raw_output_hash: raw_output_hash,
        p_confirmed_field_keys: confirmed_field_keys,
      },
    );

    if (rpcError) {
      Sentry.captureException(wrapAdminError(rpcError), {
        tags: { component: "api.ocr.confirm", path: "rpc.error" },
      });
      return NextResponse.json(
        { error: "Failed to confirm OCR job" },
        { status: 500 },
      );
    }

    if (!data?.success) {
      const sentinel = data?.error ?? "";
      const mapped = SENTINEL_MAP[sentinel];
      if (!mapped) {
        Sentry.captureException(
          new Error(
            `Unknown confirm_ocr_job sentinel: ${sentinel || "(empty)"}`,
          ),
          { tags: { component: "api.ocr.confirm", path: "rpc.fallthrough" } },
        );
        return NextResponse.json(
          { error: "Failed to confirm OCR job" },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: mapped.message },
        { status: mapped.status },
      );
    }

    try {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: user.id,
        event: "ocr_review_confirmed",
        properties: {
          org_id: orgId,
          document_id: jobId,
          field_count: confirmed_field_keys.length,
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
