import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

const VALID_REACTIONS = ['heart', 'thinking_of_you', 'strong', 'grateful'] as const

const postBodySchema = z.object({
  userId:   z.string().uuid(),
  reaction: z.enum(VALID_REACTIONS),
  note:     z.string().max(280).optional(),
})

const deleteBodySchema = z.object({
  userId: z.string().uuid(),
})

type RouteContext = { params: Promise<{ eventId: string }> }

function parseEventId(eventId: string) {
  return z.string().uuid().safeParse(eventId)
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { eventId } = await params
    const idParsed = parseEventId(eventId)
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const { data: reactions, error } = await supabaseAdmin
      .from('journal_reactions')
      .select('reaction, user_id')
      .eq('event_id', idParsed.data)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count each reaction type and flag which one the current user has set
    const counts: Record<string, number> = {}
    let myReaction: string | null = null

    for (const r of reactions ?? []) {
      counts[r.reaction] = (counts[r.reaction] ?? 0) + 1
      if (userId && r.user_id === userId) myReaction = r.reaction
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
  try {
    const { eventId } = await params
    const idParsed = parseEventId(eventId)
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 })
    }

    const body = postBodySchema.safeParse(await request.json())
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
    }

    const { userId, reaction, note } = body.data

    // Upsert — replaces an existing reaction from this user on this event
    const { error } = await supabaseAdmin
      .from('journal_reactions')
      .upsert(
        { event_id: idParsed.data, user_id: userId, reaction, note: note ?? null },
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
  try {
    const { eventId } = await params
    const idParsed = parseEventId(eventId)
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 })
    }

    const body = deleteBodySchema.safeParse(await request.json())
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('journal_reactions')
      .delete()
      .eq('event_id', idParsed.data)
      .eq('user_id', body.data.userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
