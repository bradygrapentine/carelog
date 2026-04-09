import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params

    const { data, error } = await supabaseAdmin
      .from('outer_circle_requests')
      .select('id, title, description, request_type, slots_total, slots_filled, needed_by, active')
      .eq('share_token', shareToken)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!data.active) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      id:           data.id,
      title:        data.title,
      description:  data.description,
      request_type: data.request_type,
      slots_total:  data.slots_total,
      slots_filled: data.slots_filled,
      needed_by:    data.needed_by,
      active:       data.active,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
