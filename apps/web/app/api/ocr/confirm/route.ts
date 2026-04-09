import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'

const confirmSchema = z.object({
  jobId:        z.string().uuid(),
  orgId:        z.string().uuid(),
  recipientId:  z.string().uuid(),
  drug_name:    z.string().min(1),
  dosage:       z.string().min(1),
  instructions: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { jobId, orgId, recipientId, drug_name, dosage, instructions } = parsed.data

    // Verify coordinator membership
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .single()

    if (!membership || membership.role !== 'coordinator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify job belongs to this org
    const { data: job } = await supabaseAdmin
      .from('ocr_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('org_id', orgId)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Create medication row
    const { error: medError } = await supabaseAdmin
      .from('medications')
      .insert({
        org_id:       orgId,
        recipient_id: recipientId,
        drug_name,
        dosage,
        instructions: instructions ?? null,
        created_by:   user.id,
      })

    if (medError) {
      return NextResponse.json({ error: medError.message }, { status: 500 })
    }

    // Mark job as confirmed
    const { error: updateError } = await supabaseAdmin
      .from('ocr_jobs')
      .update({ status: 'confirmed' })
      .eq('id', jobId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
