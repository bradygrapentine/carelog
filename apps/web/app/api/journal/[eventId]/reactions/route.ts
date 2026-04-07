import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'
import { parseBody } from '@/lib/parseBody'

const VALID_REACTIONS = ['heart', 'thinking_of_you', 'strong', 'grateful'] as const

const postBodySchema = z.object({
  reaction: z.enum(VALID_REACTIONS),
  note:     z.string().max(280).optional(),
})

type RouteContext = { params: Promise<{ eventId: string }> }

function parseEventId(eventId: string) {
  return z.string().uuid().safeParse(eventId)
}

/**
 * Verify the user is an active member of the org that owns this event.
 * supabaseAdmin bypasses RLS so we enforce the same access rule explicitly —
 * mirrors the check in journal/route.ts POST.
 */
async function userCanAccessEvent(userId: string, eventId: string): Promise<boolean> {
  const { data: event } = await supabaseAdmin
    .from('care_events')
    .select('org_id')
    .eq('id', eventId)
    .single()

  if (!event) return false

  const { data: membership } = await supabaseAdmin
    .from('memberships')
    .select('id')
    .eq('org_id', event.org_id)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .single()

  return !!membership
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const limited = await rateLimit(request, 'journal/reactions')
  if (limited) return limited

  // Auth required — myReaction is read from the authenticated user's session.
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { eventId } = await params
    const idParsed = parseEventId(eventId)
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 })
    }

    if (!await userCanAccessEvent(user.id, idParsed.data)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: reactions, error } = await supabaseAdmin
      .from('journal_reactions')
      .select('reaction, user_id')
      .eq('event_id', idParsed.data)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const counts: Record<string, number> = {}
    let myReaction: string | null = null

    for (const r of reactions ?? []) {
      counts[r.reaction] = (counts[r.reaction] ?? 0) + 1
      if (r.user_id === user.id) myReaction = r.reaction
    }

    return NextResponse.json({ counts, myReaction })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const limited = await rateLimit(request, 'journal/reactions')
  if (limited) return limited

  const { data: body, error: bodyError } = await parseBody(request, postBodySchema)
  if (bodyError) return bodyError

  // userId comes from the authenticated session — never from the request body.
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { eventId } = await params
    const idParsed = parseEventId(eventId)
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 })
    }

    if (!await userCanAccessEvent(user.id, idParsed.data)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { reaction, note } = body

    const { error } = await supabaseAdmin
      .from('journal_reactions')
      .upsert(
        { event_id: idParsed.data, user_id: user.id, reaction, note: note ?? null },
        { onConflict: 'event_id,user_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  const limited = await rateLimit(request, 'journal/reactions')
  if (limited) return limited

  // userId comes from the authenticated session — never from the request body.
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { eventId } = await params
    const idParsed = parseEventId(eventId)
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 })
    }

    if (!await userCanAccessEvent(user.id, idParsed.data)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('journal_reactions')
      .delete()
      .eq('event_id', idParsed.data)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
