import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { journalPayload } from '@carelog/schemas'

const journalPostSchema = z.object({
  recipientId: z.string().uuid(),
  orgId:       z.string().uuid(),
  userId:      z.string().uuid(),
  text:        z.string().min(1),
  mood:        z.enum(['good', 'okay', 'difficult', 'crisis']).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recipientId = searchParams.get('recipientId')

    const parsed = z.string().uuid().safeParse(recipientId)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid recipientId' }, { status: 400 })
    }

    const { data: events, error } = await supabaseAdmin
      .from('care_events')
      .select('*')
      .eq('recipient_id', parsed.data)
      .order('occurred_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: events ?? [] })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = journalPostSchema.safeParse(await request.json())
    if (!body.success) {
      return NextResponse.json({ error: body.error.issues[0].message }, { status: 400 })
    }

    const { recipientId, orgId, userId, text, mood } = body.data

    // Validate the payload against the shared journal schema before writing
    const payload = journalPayload.parse({ text, mood })

    const { data, error } = await supabaseAdmin
      .from('care_events')
      .insert({
        org_id:       orgId,
        recipient_id: recipientId,
        actor_id:     userId,
        event_type:   'journal',
        entry_kind:   'human',
        payload,
        occurred_at:  new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event: data })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
