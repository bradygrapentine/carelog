import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'
import { parseBody } from '@/lib/parseBody'

const flagBodySchema = z.object({
  flagged: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const limited = await rateLimit(request, 'journal/flag')
  if (limited) return limited

  const { data: body, error: bodyError } = await parseBody(request, flagBodySchema)
  if (bodyError) return bodyError

  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { eventId } = await params

    const idParsed = z.string().uuid().safeParse(eventId)
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 })
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

    // Verify the AUTHENTICATED user's role — never trust client-supplied userId.
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .single()

    if (!membership || membership.role === 'supporter') {
      return NextResponse.json({ error: 'Not authorized to flag entries' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('care_events')
      .update({ flagged: body.flagged })
      .eq('id', idParsed.data)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, flagged: body.flagged })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
