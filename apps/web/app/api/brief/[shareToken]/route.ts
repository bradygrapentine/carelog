import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params

    const { data: brief, error } = await supabaseAdmin
      .from('care_briefs')
      .select('id, title, content, includes, expires_at, revoked, created_at')
      .eq('share_token', shareToken)
      .eq('revoked', false)
      .single()

    if (error || !brief) {
      return NextResponse.json({ error: 'Care brief not found' }, { status: 404 })
    }

    // Check expiry if set
    if (brief.expires_at && new Date(brief.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This care brief has expired' }, { status: 410 })
    }

    return NextResponse.json({
      id:         brief.id,
      title:      brief.title,
      content:    brief.content,
      includes:   brief.includes,
      created_at: brief.created_at,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
