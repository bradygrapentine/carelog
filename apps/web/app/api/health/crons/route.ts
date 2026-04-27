import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

export async function GET(req: Request) {
  const secret = req.headers.get("x-health-secret");
  if (!secret || secret !== process.env.HEALTH_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("cron_runs")
    .select("function_id, last_ran_at, last_status, error_message")
    .order("function_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    crons: data ?? [],
    checked_at: new Date().toISOString(),
  });
}
