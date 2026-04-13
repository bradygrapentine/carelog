import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId } = await params;

    const { data: job, error } = await supabaseAdmin
      .from("ocr_jobs")
      .select(
        "id, status, parsed_data, raw_text, created_at, created_by, category",
      )
      .eq("id", jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (job.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ job });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
