import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params

    // Read body before any awaits — form values synchronously
    const body = await request.json() as {
      name:       string
      email:      string
      note?:      string
      slot_date?: string
    }

    const { name, email, note, slot_date } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    // Look up the request by share_token to get its id
    const { data: ocRequest, error: lookupError } = await supabaseAdmin
      .from('outer_circle_requests')
      .select('id, active')
      .eq('share_token', shareToken)
      .single()

    if (lookupError || !ocRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!ocRequest.active) {
      return NextResponse.json({ error: 'This request is no longer available' }, { status: 410 })
    }

    const { error: rpcError } = await supabaseAdmin.rpc('claim_outer_circle_slot', {
      p_request_id: ocRequest.id,
      p_name:       name,
      p_email:      email,
      p_date:       slot_date ?? null,
    })

    if (rpcError) {
      if (rpcError.message?.includes('slot_unavailable')) {
        return NextResponse.json({ error: 'No slots available' }, { status: 409 })
      }
      throw new Error(rpcError.message)
    }

    return NextResponse.json({ claimed: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
