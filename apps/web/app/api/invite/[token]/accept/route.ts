import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await rateLimit(request, 'invite/accept')
  if (limited) return limited

  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { token } = await params

    const { data, error } = await supabaseAdmin.rpc('accept_invite', {
      p_token:   token,
      p_user_id: user.id,
      p_email:   user.email?.toLowerCase().trim() ?? '',
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data.success) {
      const statusMap: Record<string, number> = {
        not_found:      404,
        email_mismatch: 403,
        already_used:   410,
      }
      const status = statusMap[data.error] ?? 400
      const messageMap: Record<string, string> = {
        not_found:      'Invite not found or has expired',
        email_mismatch: 'This invite was sent to a different email address',
        already_used:   'This invite has already been used. Ask the coordinator to send a new one.',
      }
      return NextResponse.json(
        { error: messageMap[data.error] ?? data.error },
        { status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
