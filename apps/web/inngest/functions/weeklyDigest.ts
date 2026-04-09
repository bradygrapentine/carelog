import { inngest } from '../client'
import { supabaseAdmin } from '../../server/supabaseAdmin.server'
import { resend } from '../../server/resend.server'
import { digestMinuteOffset } from '@carelog/utils'

type Entry = {
  id: string
  occurred_at: string
  flagged: boolean
  payload: { text?: string; mood?: string }
}

type Shift = {
  start_at:      string
  end_at:        string
  assignee_name: string
  status:        string
}

export function digestHtml(opts: {
  orgName:     string
  entries:     Entry[]
  recipientId: string
  appUrl:      string
  shifts:      Shift[]
}): string {
  const { orgName, entries, recipientId, appUrl } = opts
  const journalUrl = appUrl + '/journal/' + recipientId

  const moodCounts: Record<string, number> = {}
  for (const e of entries) {
    const mood = e.payload.mood
    if (mood) moodCounts[mood] = (moodCounts[mood] ?? 0) + 1
  }
  const moodLine = Object.entries(moodCounts)
    .map(([m, n]) => n + ' ' + m)
    .join(', ')

  const flaggedCount = entries.filter(e => e.flagged).length

  const previewHtml = entries.slice(0, 3).map(e => {
    const text = e.payload.text ?? ''
    const snippet = text.length > 140 ? text.slice(0, 140) + '\u2026' : text
    const mood = e.payload.mood
    const date = new Date(e.occurred_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
    const meta = [date, mood, e.flagged ? 'flagged for doctor' : ''].filter(Boolean).join(' \u00b7 ')
    return (
      '<div style="padding:12px 0;border-bottom:1px solid #f5f5f5;">' +
        '<p style="font-size:14px;color:#111;margin:0 0 4px;line-height:1.5;">' + snippet + '</p>' +
        '<p style="font-size:12px;color:#aaa;margin:0;">' + meta + '</p>' +
      '</div>'
    )
  }).join('')

  const moreCount = entries.length - 3
  const moreHtml = moreCount > 0
    ? '<p style="font-size:13px;color:#aaa;margin:8px 0 0;">+ ' + moreCount + ' more ' + (moreCount === 1 ? 'entry' : 'entries') + '</p>'
    : ''

  const flaggedHtml = flaggedCount > 0
    ? (
      '<div style="background:#eff6ff;border-left:3px solid #2563eb;padding:10px 14px;margin-bottom:20px;border-radius:0 6px 6px 0;">' +
        '<p style="font-size:13px;color:#1d4ed8;margin:0;">' +
          flaggedCount + (flaggedCount === 1 ? ' entry was' : ' entries were') + ' flagged for doctor review.' +
        '</p>' +
      '</div>'
    )
    : ''

  const entrySummary = entries.length + (entries.length === 1 ? ' entry' : ' entries') + ' shared this week' +
    (moodLine ? ' \u00b7 ' + moodLine : '')

  return (
    '<!DOCTYPE html>' +
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111;background:#fff;">' +
      '<h2 style="font-size:18px;font-weight:600;margin:0 0 6px;">' + orgName + ' \u2014 this week</h2>' +
      '<p style="font-size:14px;color:#777;margin:0 0 24px;">' + entrySummary + '.</p>' +
      flaggedHtml +
      previewHtml +
      moreHtml +
      (opts.shifts.length > 0
        ? (
          '<div style="margin-top:24px;padding-top:20px;border-top:1px solid #f5f5f5;">' +
            '<p style="font-size:14px;font-weight:600;color:#111;margin:0 0 12px;">Here\'s who\'s helping this week</p>' +
            opts.shifts.map(function(s) {
              var day = new Date(s.start_at).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
              var startTime = new Date(s.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
              var endTime   = new Date(s.end_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
              return (
                '<div style="padding:6px 0;border-bottom:1px solid #f9f9f9;">' +
                  '<p style="font-size:13px;color:#333;margin:0;">' + s.assignee_name + '</p>' +
                  '<p style="font-size:12px;color:#aaa;margin:2px 0 0;">' + day + ' \u00b7 ' + startTime + '\u2013' + endTime + '</p>' +
                '</div>'
              )
            }).join('') +
          '</div>'
        )
        : '') +
      '<div style="margin-top:28px;">' +
        '<a href="' + journalUrl + '" style="display:inline-block;background:#111;color:#fff;font-size:14px;font-weight:500;padding:10px 20px;border-radius:8px;text-decoration:none;">View the full journal \u2192</a>' +
      '</div>' +
      '<hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;">' +
      '<p style="font-size:12px;color:#bbb;margin:0;">You\'re receiving this because you\'re part of the ' + orgName + ' care team on Carelog.</p>' +
    '</body></html>'
  )
}

export const weeklyDigest = inngest.createFunction(
  { id: 'weekly-digest' },
  { cron: 'TZ=UTC 0 8 * * 1' }, // Every Monday at 8am UTC
  async ({ step, logger }) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Step 1: find orgs with journal activity this week
    const activeOrgs = await step.run('find-active-orgs', async () => {
      const { data, error } = await supabaseAdmin
        .from('care_events')
        .select('org_id, recipient_id')
        .eq('event_type', 'journal')
        .eq('entry_kind', 'human')
        .gte('occurred_at', since)

      if (error) throw new Error('Query failed: ' + error.message)

      // One representative recipient per org (for the journal link)
      const seen = new Map<string, string>()
      for (const row of (data ?? [])) {
        if (!seen.has(row.org_id)) seen.set(row.org_id, row.recipient_id)
      }
      return Array.from(seen.entries()).map(([orgId, recipientId]) => ({ orgId, recipientId }))
    })

    logger.info('Orgs with activity this week: ' + activeOrgs.length)
    if (activeOrgs.length === 0) return { sent: 0 }

    // Step 2: send digest for each org (parallel, independently retryable)
    await Promise.all(
      activeOrgs.map(({ orgId, recipientId }) =>
        step.run('send-digest-' + orgId, async () => {
          // Org name
          const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('name')
            .eq('id', orgId)
            .single()

          if (!org) throw new Error('Org not found: ' + orgId)

          // Journal entries for the past week
          const { data: entries, error: entriesError } = await supabaseAdmin
            .from('care_events')
            .select('id, occurred_at, flagged, payload')
            .eq('org_id', orgId)
            .eq('event_type', 'journal')
            .eq('entry_kind', 'human')
            .gte('occurred_at', since)
            .order('occurred_at', { ascending: false })

          if (entriesError) throw new Error('Entries query failed: ' + entriesError.message)
          if (!entries || entries.length === 0) return

          // Active members
          const { data: memberships, error: membershipsError } = await supabaseAdmin
            .from('memberships')
            .select('user_id')
            .eq('org_id', orgId)
            .not('accepted_at', 'is', null)

          if (membershipsError) throw new Error('Memberships query failed: ' + membershipsError.message)
          if (!memberships || memberships.length === 0) return

          // Resolve member emails — deduplicate user IDs, fetch in parallel
          const memberIds = [...new Set(memberships.map(m => m.user_id))]
          const memberUsers = await Promise.all(
            memberIds.map(id => supabaseAdmin.auth.admin.getUserById(id))
          )
          const emails: string[] = memberUsers
            .map(r => r.data.user?.email)
            .filter((e): e is string => !!e)

          if (emails.length === 0) return

          // Upcoming week's shifts
          const weekStart = new Date()
          const weekEnd   = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

          const { data: rawShifts } = await supabaseAdmin
            .from('shifts')
            .select('start_at, end_at, status, assignee_user_id')
            .eq('org_id', orgId)
            .gte('start_at', weekStart.toISOString())
            .lte('start_at', weekEnd.toISOString())
            .neq('status', 'cancelled')
            .order('start_at', { ascending: true })

          // Resolve assignee names — deduplicate user IDs, fetch in parallel
          const assigneeIds = [...new Set((rawShifts ?? []).map(s => s.assignee_user_id))]
          const assigneeUsers = await Promise.all(
            assigneeIds.map(id => supabaseAdmin.auth.admin.getUserById(id))
          )
          const assigneeNameMap = new Map<string, string>()
          for (let i = 0; i < assigneeIds.length; i++) {
            const u = assigneeUsers[i].data.user
            assigneeNameMap.set(assigneeIds[i], u?.user_metadata?.display_name ?? u?.email ?? 'Care team member')
          }

          const digestShifts: Shift[] = (rawShifts ?? []).map(s => ({
            start_at:      s.start_at,
            end_at:        s.end_at,
            assignee_name: assigneeNameMap.get(s.assignee_user_id) ?? 'Care team member',
            status:        s.status,
          }))

          // Stagger sends across orgs to avoid burst load (BF-05)
          await step.sleep('stagger-' + orgId, digestMinuteOffset(orgId) + 's')

          if (!resend) {
            logger.warn('RESEND_API_KEY not set — skipping email for org ' + orgId)
            return
          }

          const html = digestHtml({ orgName: org.name, entries: entries as Entry[], recipientId, appUrl, shifts: digestShifts })
          const subject = org.name + ' \u2014 ' + entries.length + (entries.length === 1 ? ' entry' : ' entries') + ' this week'

          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
            to: emails,
            subject,
            html,
          })

          logger.info('Digest sent to ' + emails.length + ' members of ' + org.name)
        })
      )
    )
  }
)
