import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

const discardSchema = z.object({
  jobId: z.string().uuid(),
  orgId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, 'ocr/discard')
  if (limited) return limited

  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = discardSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { jobId, orgId } = parsed.data

    // Verify coordinator membership
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .single()

    if (!membership || membership.role !== 'coordinator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify job belongs to this org
    const { data: job } = await supabaseAdmin
      .from('ocr_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('org_id', orgId)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('ocr_jobs')
      .update({ status: 'failed' })
      .eq('id', jobId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
