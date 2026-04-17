import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('cron_runs')
    .select('function_id, last_ran_at, last_status, error_message')
    .order('function_id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    crons: data ?? [],
    checked_at: new Date().toISOString(),
  })
}
