import { inngest } from '../client'
import { supabaseAdmin } from '../../server/supabaseAdmin.server'
import { sendPushToOrgCoordinators } from '../pushNotification'

// ─── pure gap detection logic (testable without Inngest) ─────────────────────

export interface CoverageWindow {
  id:            string
  org_id:        string
  recipient_id:  string
  label:         string | null
  starts_at:     string  // reference epoch timestamp (1970-01-04 + day_of_week + time)
  ends_at:       string
  day_of_week:   number
  required_role: string | null
}

export function detectGaps(
  windows: CoverageWindow[],
  shifts: Array<{ start_at: string; end_at: string; status: string; assignee_user_id: string }>,
  today: Date
): CoverageWindow[] {
  const todayDow = today.getUTCDay() // 0=Sunday
  const todayDateStr = today.toISOString().slice(0, 10) // 'YYYY-MM-DD'

  return windows.filter(win => {
    if (win.day_of_week !== todayDow) return false

    // Compute today's concrete start/end timestamps from the reference epoch timestamps
    // Reference: 1970-01-04 = Sunday (day 0), so extract HH:MM from starts_at/ends_at
    const refStart = new Date(win.starts_at)
    const refEnd   = new Date(win.ends_at)
    const winStart = new Date(todayDateStr + 'T' +
      String(refStart.getUTCHours()).padStart(2, '0') + ':' +
      String(refStart.getUTCMinutes()).padStart(2, '0') + ':00Z')
    const winEnd   = new Date(todayDateStr + 'T' +
      String(refEnd.getUTCHours()).padStart(2, '0') + ':' +
      String(refEnd.getUTCMinutes()).padStart(2, '0') + ':00Z')

    // A shift covers the window if it overlaps AND is not cancelled
    const covered = shifts.some(s => {
      if (s.status === 'cancelled') return false
      return new Date(s.start_at) < winEnd && new Date(s.end_at) > winStart
    })

    return !covered
  })
}

// ─── Inngest function ─────────────────────────────────────────────────────────

export const gapDetector = inngest.createFunction(
  { id: 'gap-detector' },
  { cron: 'TZ=UTC 0 6 * * *' }, // Daily at 6am UTC
  async ({ step, logger }) => {
    const today = new Date()

    // Step 1: find all recurring coverage windows
    const allWindows = await step.run('find-recurring-windows', async () => {
      const { data, error } = await supabaseAdmin
        .from('coverage_windows')
        .select('id, org_id, recipient_id, label, starts_at, ends_at, day_of_week, required_role')
        .eq('recurring', true)
        .eq('day_of_week', today.getUTCDay())

      if (error) throw new Error('Query failed: ' + error.message)
      return data ?? []
    })

    logger.info('Recurring windows for today: ' + allWindows.length)
    if (allWindows.length === 0) return { gaps: 0 }

    // Group windows by org+recipient to batch shift queries
    const orgRecipientPairs = new Map<string, { orgId: string; recipientId: string }>()
    for (const w of allWindows) {
      const key = w.org_id + ':' + w.recipient_id
      orgRecipientPairs.set(key, { orgId: w.org_id, recipientId: w.recipient_id })
    }

    let totalGaps = 0

    await Promise.all(
      Array.from(orgRecipientPairs.values()).map(({ orgId, recipientId }) =>
        step.run('check-gaps-' + orgId + '-' + recipientId, async () => {
          // Fetch today's shifts for this recipient
          const todayStart = new Date(today.toISOString().slice(0, 10) + 'T00:00:00Z').toISOString()
          const todayEnd   = new Date(today.toISOString().slice(0, 10) + 'T23:59:59Z').toISOString()

          const { data: shifts, error: shiftsError } = await supabaseAdmin
            .from('shifts')
            .select('start_at, end_at, status, assignee_user_id')
            .eq('org_id', orgId)
            .eq('recipient_id', recipientId)
            .lt('start_at', todayEnd)
            .gt('end_at', todayStart)
            .neq('status', 'cancelled')

          if (shiftsError) throw new Error('Shifts query failed: ' + shiftsError.message)

          const orgWindows = allWindows.filter(
            w => w.org_id === orgId && w.recipient_id === recipientId
          )
          const gaps = detectGaps(orgWindows, shifts ?? [], today)

          for (const gap of gaps) {
            // Idempotent: check if we already created a gap event for this window today
            const gapPayload = {
              gap:           true,
              window_id:     gap.id,
              label:         gap.label,
              start_at:      todayStart,
              end_at:        todayEnd,
              required_role: gap.required_role,
            }
            const idempotencyKey = 'gap-' + gap.id + '-' + today.toISOString().slice(0, 10)

            const { data: existing } = await supabaseAdmin
              .from('care_events')
              .select('id')
              .eq('org_id', orgId)
              .eq('recipient_id', recipientId)
              .eq('event_type', 'task')
              .eq('entry_kind', 'system')
              .filter('payload->>gap', 'eq', 'true')
              .filter('payload->>window_id', 'eq', gap.id)
              .gte('occurred_at', todayStart)
              .limit(1)

            if (!existing || existing.length === 0) {
              await supabaseAdmin.from('care_events').insert({
                org_id:       orgId,
                recipient_id: recipientId,
                event_type:   'task',
                entry_kind:   'system',
                occurred_at:  today.toISOString(),
                payload:      { ...gapPayload, idempotency_key: idempotencyKey },
                flagged:      false,
              })
              totalGaps++
              logger.info('Gap detected: ' + (gap.label ?? gap.id) + ' for org ' + orgId)
              try {
                await sendPushToOrgCoordinators(orgId, {
                  title: 'Coverage gap detected',
                  body: (gap.label ?? 'A shift window') + ' has no coverage today.',
                  data: { screen: 'schedule' },
                })
              } catch (pushErr) {
                logger.warn('Push failed for gap ' + gap.id + ': ' + String(pushErr))
              }
            }
          }
        })
      )
    )

    return { gaps: totalGaps }
  }
)
