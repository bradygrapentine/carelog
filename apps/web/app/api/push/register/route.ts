import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'
import { rateLimit } from '@/lib/rateLimit'

const bodySchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
})

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, 'push/register')
  if (limited) return limited

  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { token, platform } = parsed.data

  const { error } = await supabaseAdmin
    .from('push_tokens')
    .upsert({ auth_user_id: user.id, token, platform }, { onConflict: 'token' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
