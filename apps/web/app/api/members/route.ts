import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    const parsed = z.string().uuid().safeParse(orgId)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid orgId' }, { status: 400 })
    }

    const { data: memberships, error } = await supabaseAdmin
      .from('memberships')
      .select('id, role, user_id')
      .eq('org_id', parsed.data)
      .not('accepted_at', 'is', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Resolve each member's email from auth.admin — supabaseAdmin is required,
    // auth.users is not accessible to the anon or authenticated roles.
    const members = await Promise.all(
      (memberships ?? []).map(async (m) => {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(m.user_id)
        return { id: m.id, role: m.role, user_id: m.user_id, email: user?.email ?? null }
      })
    )

    return NextResponse.json({ members })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
