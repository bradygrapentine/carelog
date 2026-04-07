import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { createRequestSupabase, getRequestUser } from '@/lib/supabaseServer'
import { journalPayload } from '@carelog/schemas'
import { rateLimit } from '@/lib/rateLimit'
import { parseBody } from '@/lib/parseBody'

const journalPostSchema = z.object({
  recipientId: z.string().uuid(),
  orgId:       z.string().uuid(),
  text:        z.string().min(1).max(10000),
  mood:        z.enum(['good', 'okay', 'difficult', 'crisis']).optional(),
})

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, 'journal')
  if (limited) return limited

  try {
    const supabase = await createRequestSupabase(request)
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const recipientId = searchParams.get('recipientId')

    const parsed = z.string().uuid().safeParse(recipientId)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid recipientId' }, { status: 400 })
    }

    const { data: events, error } = await supabase
      .from('care_events')
      .select('*')
      .eq('recipient_id', parsed.data)
      .order('occurred_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ events: events ?? [] })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, 'journal')
  if (limited) return limited

  const { data: body, error: bodyError } = await parseBody(request, journalPostSchema)
  if (bodyError) return bodyError

  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { recipientId, orgId, text, mood } = body

    // Verify the authenticated user is an active member of the target org.
    // supabaseAdmin bypasses RLS, so we must enforce org membership explicitly.
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify recipientId belongs to orgId. Without this check an org member could
    // write events against any recipient UUID — including ones in other orgs.
    const { data: recipient } = await supabaseAdmin
      .from('care_recipients')
      .select('id')
      .eq('id', recipientId)
      .eq('org_id', orgId)
      .single()

    if (!recipient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const payload = journalPayload.parse({ text, mood })

    const { data, error } = await supabaseAdmin
      .from('care_events')
      .insert({
        org_id:       orgId,
        recipient_id: recipientId,
        actor_id:     user.id,
        event_type:   'journal',
        entry_kind:   'human',
        payload,
        occurred_at:  new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ event: data })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
