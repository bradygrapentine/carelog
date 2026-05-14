import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin, wrapAdminError } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";
import {
  OcrJobStateMachine,
  OcrTransitionError,
  type OcrStatus,
} from "@/lib/ocr/jobStateMachine";

const discardSchema = z.object({
  jobId: z.string().uuid(),
  orgId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, "ocr/discard");
  if (limited) return limited;

  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = discardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { jobId, orgId } = parsed.data;

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

    // Verify job belongs to this org; read status for state machine
    const { data: job } = await supabaseAdmin
      .from("ocr_jobs")
      .select("id, status")
      .eq("id", jobId)
      .eq("org_id", orgId)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Validate state transition via state machine
    const sm = new OcrJobStateMachine(job.status as OcrStatus);
    try {
      sm.transitionTo("failed");
    } catch (e) {
      if (e instanceof OcrTransitionError) {
        return NextResponse.json(
          { error: `Invalid transition: ${e.from} → ${e.to}` },
          { status: 400 },
        );
      }
      throw e;
    }

    // Optimistic lock: only update if status hasn't changed
    const { error, count } = await supabaseAdmin
      .from("ocr_jobs")
      .update({ status: "failed" })
      .eq("id", jobId)
      .eq("status", job.status)
      .select("id");

    if (error)
      return NextResponse.json(
        { error: wrapAdminError(error).message },
        { status: 500 },
      );
    if (!count || count === 0) {
      return NextResponse.json(
        { error: "Conflict: job status changed concurrently" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const errorMessage =
      e instanceof Error ? e.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
