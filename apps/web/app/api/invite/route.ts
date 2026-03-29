import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { createInviteSchema } from '@carelog/schemas'

const inviteRequestSchema = createInviteSchema.extend({
  // invitedBy comes from the client until session-scoped auth is used server-side (tech debt #2)
  invitedBy: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = inviteRequestSchema.safeParse(await request.json())
    if (!body.success) {
      // role, email, uuid format are all covered by the schema
      return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
    }

    const { orgId, recipientId, role, email, invitedBy } = body.data
    const normalizedEmail = email.toLowerCase().trim()

    // Check for an existing pending invite for this email + org.
    // invite_tokens links to memberships via membership_id; filter org_id via the join.
    const { data: existingInvite } = await supabaseAdmin
      .from('invite_tokens')
      .select('id, memberships!inner(org_id)')
      .eq('email', normalizedEmail)
      .eq('memberships.org_id', orgId)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)

    if (existingInvite && existingInvite.length > 0) {
      return NextResponse.json(
        { error: 'An invite for this email is already pending for this care team' },
        { status: 409 }
      )
    }

    // Create a pending membership. user_id is set to invitedBy as a placeholder —
    // the row doesn't yet belong to the invitee. When the invite is accepted,
    // acceptInvite() overwrites user_id with the real user's ID.
    // See TECH_DEBT.md #8 for the proper fix using a sentinel UUID.
    const { data: membership, error: mError } = await supabaseAdmin
      .from('memberships')
      .insert({
        org_id:       orgId,
        user_id:      invitedBy, // placeholder until accepted
        recipient_id: recipientId ?? null,
        role,
        invited_at:   new Date().toISOString(),
        accepted_at:  null,
      })
      .select('id')
      .single()

    if (mError || !membership) {
      return NextResponse.json({ error: 'Failed to create membership' }, { status: 500 })
    }

    const { data: invite, error: iError } = await supabaseAdmin
      .from('invite_tokens')
      .insert({
        membership_id: membership.id,
        email:         normalizedEmail,
      })
      .select('token')
      .single()

    if (iError || !invite) {
      return NextResponse.json({ error: 'Failed to create invite token' }, { status: 500 })
    }

    // Hardcoded to localhost for local dev. In production this should be
    // derived from a NEXT_PUBLIC_APP_URL env var.
    // TODO: send invite email via Resend instead of returning the URL to the UI.
    const inviteUrl = 'http://localhost:3000/invite/' + invite.token

    console.log('[invite] URL for', email, ':', inviteUrl)

    return NextResponse.json({ success: true, inviteUrl })
  } catch (e: unknown) {
    console.error('[invite] error:', e)
    const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
