import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
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

    // Fetch job — read recipient_id from the row, never trust client-supplied value
    const { data: job } = await supabaseAdmin
      .from("ocr_jobs")
      .select("id, recipient_id")
      .eq("id", jobId)
      .eq("org_id", orgId)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
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

    // Mark job as confirmed
    const { error: updateError } = await supabaseAdmin
      .from("ocr_jobs")
      .update({ status: "confirmed" })
      .eq("id", jobId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
