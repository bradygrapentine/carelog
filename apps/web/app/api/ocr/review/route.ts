import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    const parsed = z.string().uuid().safeParse(orgId)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid orgId' }, { status: 400 })
    }

    const validOrgId = parsed.data

    // Verify coordinator membership
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('org_id', validOrgId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .single()

    if (!membership || membership.role !== 'coordinator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: jobs, error } = await supabaseAdmin
      .from('ocr_jobs')
      .select('id, recipient_id, image_url, raw_text, parsed_payload, created_at')
      .eq('org_id', validOrgId)
      .eq('status', 'needs_review')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ jobs: jobs ?? [] })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
