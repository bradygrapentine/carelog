import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

export async function GET(req: Request) {
  const token = req.headers.get("authorization");
  if (!token || token !== process.env.HEALTH_CRONS_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("cron_runs")
    .select("function_id, last_ran_at, last_status, error_message")
    .order("function_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Redact error_message to avoid leaking stack traces, SQL fragments, or
  // internal IDs to callers.
  const crons = (data ?? []).map((row) => ({
    ...row,
    error_message: row.error_message ? "internal error" : null,
  }));

  return NextResponse.json({
    crons,
    checked_at: new Date().toISOString(),
  });
}
