import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";

const fieldSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  type: z.enum(["text", "number", "date", "currency"]),
  confidence: z.number().min(0).max(1),
});

const bodySchema = z.object({
  jobId: z.string().uuid(),
  fields: z.array(fieldSchema).min(1),
});

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, "ocr/save-fields");
  if (limited) return limited;

  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { jobId, fields } = parsed.data;

    const { data: job, error: fetchError } = await supabaseAdmin
      .from("ocr_jobs")
      .select("id, created_by, parsed_data")
      .eq("id", jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingParsed = (job.parsed_data ?? {}) as {
      document_type?: string;
      fields?: unknown[];
    };
    const updatedParsed = { ...existingParsed, fields };

    const { error: updateError } = await supabaseAdmin
      .from("ocr_jobs")
      .update({ status: "confirmed", parsed_data: updatedParsed })
      .eq("id", jobId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
