import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recipientId = searchParams.get('recipientId')

    if (!recipientId) {
      return NextResponse.json({ error: 'Missing recipientId' }, { status: 400 })
    }

    const admin = getAdminClient()

    const { data: events, error } = await admin
      .from('care_events')
      .select('*')
      .eq('recipient_id', recipientId)
      .order('occurred_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: events ?? [] })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { recipientId, orgId, text, mood, userId } = await request.json()

    if (!recipientId || !orgId || !text || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const admin = getAdminClient()

    const { data, error } = await admin
      .from('care_events')
      .insert({
        org_id:       orgId,
        recipient_id: recipientId,
        actor_id:     userId,
        event_type:   'journal',
        entry_kind:   'human',
        payload:      { text, mood: mood || null },
        occurred_at:  new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ event: data })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}