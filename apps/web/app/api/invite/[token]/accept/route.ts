import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

const acceptBodySchema = z.object({
  userId:    z.string().uuid(),
  userEmail: z.string().email(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const body = acceptBodySchema.safeParse(await request.json())
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
    }

    const { userId, userEmail } = body.data

    const { data: invite, error } = await supabaseAdmin
      .from('invite_tokens')
      .select('id, email, consumed_at, expires_at, membership_id')
      .eq('token', token)
      .single()

    if (error || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.consumed_at) {
      return NextResponse.json({ error: 'Already used' }, { status: 410 })
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Expired' }, { status: 410 })
    }

    // Email is normalized the same way it was stored at invite creation time
    // (toLowerCase + trim). Case mismatch would silently fail without this.
    if (invite.email !== userEmail.toLowerCase().trim()) {
      return NextResponse.json(
        { error: 'This invite was sent to a different email address' },
        { status: 403 }
      )
    }

    // Mark token consumed and activate membership together. Promise.all sends both
    // updates concurrently. Note: this is not a true DB transaction — a failure
    // in one after the other succeeds leaves inconsistent state. A Postgres RPC
    // function would be the correct production fix.
    await Promise.all([
      supabaseAdmin
        .from('invite_tokens')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', invite.id),

      supabaseAdmin
        .from('memberships')
        .update({
          user_id:     userId,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invite.membership_id),
    ])

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
