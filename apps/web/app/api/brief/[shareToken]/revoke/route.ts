import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { shareToken } = await params

    // Fetch the brief to verify ownership
    const { data: brief, error: fetchError } = await supabaseAdmin
      .from('care_briefs')
      .select('id, org_id, created_by')
      .eq('share_token', shareToken)
      .single()

    if (fetchError || !brief) {
      return NextResponse.json({ error: 'Care brief not found' }, { status: 404 })
    }

    // Allow if caller created the brief OR is a coordinator of the org
    let authorized = brief.created_by === user.id

    if (!authorized) {
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('role, accepted_at')
        .eq('org_id', brief.org_id)
        .eq('user_id', user.id)
        .single()

      if (membership && membership.role === 'coordinator' && membership.accepted_at) {
        authorized = true
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('care_briefs')
      .update({ revoked: true })
      .eq('id', brief.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ revoked: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
