import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

const flagBodySchema = z.object({
  flagged: z.boolean(),
  userId:  z.string().uuid(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    const idParsed = z.string().uuid().safeParse(eventId)
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 })
    }

    const body = flagBodySchema.safeParse(await request.json())
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
    }

    // Resolve the event's org so we can check the caller's role.
    const { data: event } = await supabaseAdmin
      .from('care_events')
      .select('recipient_id, care_recipients(org_id)')
      .eq('id', idParsed.data)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const orgId = (event as unknown as { care_recipients: { org_id: string } }).care_recipients.org_id

    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', body.data.userId)
      .not('accepted_at', 'is', null)
      .single()

    if (!membership || membership.role === 'supporter') {
      return NextResponse.json({ error: 'Not authorized to flag entries' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('care_events')
      .update({ flagged: body.data.flagged })
      .eq('id', idParsed.data)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, flagged: body.data.flagged })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
