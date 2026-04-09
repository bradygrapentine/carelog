import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin }    from '@/server/supabaseAdmin.server'
import { getRequestUser }   from '@/lib/supabaseServer'
import { rateLimit }        from '@/lib/rateLimit'
import { exportRequestSchema } from '@carelog/schemas'

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, 'history/export')
    if (limited) return limited

    const user = await getRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = exportRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { orgId, recipientId, format, since } = parsed.data

    // ── 1. Role check (coordinator only) ──────────────────────────────────────
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('memberships')
      .select('role, accepted_at')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership || membership.role !== 'coordinator' || !membership.accepted_at) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── 2. Resolve identity (vault — service role only) ───────────────────────
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('care_recipients')
      .select('identity_token')
      .eq('id', recipientId)
      .eq('org_id', orgId)
      .single()

    if (recipientError || !recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    const { data: vault, error: vaultError } = await supabaseAdmin
      .from('identity_vault')
      .select('full_name, dob')
      .eq('token', recipient.identity_token)
      .single()

    if (vaultError || !vault) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
    }

    // ── 3. Fetch data (all tables scoped to org + recipient + since filter) ───
    const sinceFilter = since ?? new Date(0).toISOString() // epoch = no lower bound

    const [eventsRes, symptomsRes, medsRes, shiftsRes] = await Promise.all([
      supabaseAdmin
        .from('care_events')
        .select('id, event_type, entry_kind, occurred_at, flagged, payload')
        .eq('org_id', orgId)
        .eq('recipient_id', recipientId)
        .gte('occurred_at', sinceFilter)
        .order('occurred_at', { ascending: true })
        .limit(1000),

      supabaseAdmin
        .from('symptom_readings')
        .select('id, pain_level, mood, appetite, mobility, notes, recorded_at')
        .eq('org_id', orgId)
        .eq('recipient_id', recipientId)
        .gte('recorded_at', sinceFilter)
        .order('recorded_at', { ascending: true })
        .limit(500),

      supabaseAdmin
        .from('medications')
        .select('id, drug_name, dosage, form, instructions, prescriber, active, created_at')
        .eq('org_id', orgId)
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: true })
        .limit(200),

      supabaseAdmin
        .from('shifts')
        .select('id, assignee_user_id, start_at, end_at, notes, status')
        .eq('org_id', orgId)
        .eq('recipient_id', recipientId)
        .gte('start_at', sinceFilter)
        .order('start_at', { ascending: true })
        .limit(500),
    ])

    const exportPayload = {
      recipient_name:   vault.full_name,
      dob:              vault.dob ?? null,
      exported_at:      new Date().toISOString(),
      since:            since ?? null,
      care_events:      eventsRes.data   ?? [],
      symptom_readings: symptomsRes.data ?? [],
      medications:      medsRes.data     ?? [],
      shifts:           shiftsRes.data   ?? [],
    }

    // ── 4. Return JSON or PDF ─────────────────────────────────────────────────
    if (format === 'json') {
      return new NextResponse(JSON.stringify(exportPayload, null, 2), {
        status:  200,
        headers: {
          'Content-Type':        'application/json',
          'Content-Disposition': 'attachment; filename="care-history.json"',
        },
      })
    }

    // PDF format — rendered server-side with @react-pdf/renderer
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const React = (await import('react')).default
    const { ExportDocument } = await import('./ExportDocument')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(ExportDocument, { data: exportPayload }) as any
    )
    return new NextResponse(new Uint8Array(buffer), {
      status:  200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': 'attachment; filename="care-history.pdf"',
      },
    })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
