import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const { data: invite, error } = await supabaseAdmin
      .from('invite_tokens')
      .select('id, email, consumed_at, expires_at, membership_id')
      .eq('token', token)
      .single()

    if (error || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.consumed_at) {
      return NextResponse.json({ error: 'This invite has already been used' }, { status: 410 })
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
    }

    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('role, org_id, organizations(name)')
      .eq('id', invite.membership_id)
      .single()

    const orgName = (membership as unknown as { organizations?: { name: string } })?.organizations?.name ?? 'Care team'

    return NextResponse.json({
      email:   invite.email,
      role:    membership?.role,
      orgName,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
