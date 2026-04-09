import { inngest } from '../client'
import { supabaseAdmin } from '../../server/supabaseAdmin.server'

// ─── pure detection logic (testable without Inngest) ─────────────────────────

export interface CheckInRow {
  user_id:      string
  org_id:       string
  week_stamp:   string
  stress_score: number
}

/**
 * Returns user_ids whose stress_score was >= 4 for 2 or more consecutive weeks
 * among the provided check-ins. Input is expected to be sorted by week_stamp DESC.
 */
export function detectBurnoutRisk(checkins: CheckInRow[]): string[] {
  // Group by user_id
  const byUser = new Map<string, CheckInRow[]>()
  for (const row of checkins) {
    const existing = byUser.get(row.user_id) ?? []
    existing.push(row)
    byUser.set(row.user_id, existing)
  }

  const atRisk: string[] = []

  for (const [userId, rows] of byUser) {
    // Sort by week_stamp ascending to find consecutive streaks
    const sorted = [...rows].sort((a, b) => a.week_stamp.localeCompare(b.week_stamp))

    let consecutive = 0
    for (const row of sorted) {
      if (row.stress_score >= 4) {
        consecutive++
        if (consecutive >= 2) {
          atRisk.push(userId)
          break
        }
      } else {
        consecutive = 0
      }
    }
  }

  return atRisk
}

// ─── Inngest function ─────────────────────────────────────────────────────────

export const burnoutAlert = inngest.createFunction(
  { id: 'burnout-alert' },
  { cron: 'TZ=UTC 0 8 * * 1' }, // Weekly Monday 8am UTC (after weekly digest)
  async ({ step, logger }) => {
    const today = new Date()

    // Compute ISO week stamp for this run (used for idempotency key in alert payload)
    function computeWeekStamp(d: Date): string {
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
      const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
      return date.getUTCFullYear() + '-W' + String(week).padStart(2, '0')
    }
    const alertWeekStamp = computeWeekStamp(today)

    // Step 1: fetch the last 3 weeks of check-ins (per-org via created_at filter)
    const threeWeeksAgo = new Date(today)
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)
    const cutoff = threeWeeksAgo.toISOString()

    const recentCheckins = await step.run('fetch-recent-checkins', async () => {
      const { data, error } = await supabaseAdmin
        .from('burnout_checkins')
        .select('user_id, org_id, week_stamp, stress_score')
        .gte('created_at', cutoff)
        .order('week_stamp', { ascending: false })
        .limit(500) // generous upper bound; we filter in detectBurnoutRisk

      if (error) throw new Error('Query failed: ' + error.message)
      return (data ?? []) as CheckInRow[]
    })

    logger.info('Recent check-ins fetched: ' + recentCheckins.length)

    const atRiskUserIds = detectBurnoutRisk(recentCheckins)
    logger.info('Caregivers at burnout risk: ' + atRiskUserIds.length)

    if (atRiskUserIds.length === 0) return { alerts: 0 }

    // Build a map of user_id → org_id for alert creation
    const userOrgMap = new Map<string, string>()
    for (const row of recentCheckins) {
      if (!userOrgMap.has(row.user_id)) {
        userOrgMap.set(row.user_id, row.org_id)
      }
    }

    let totalAlerts = 0

    await Promise.all(
      atRiskUserIds.map(userId =>
        step.run('alert-' + userId, async () => {
          const orgId = userOrgMap.get(userId)
          if (!orgId) return

          // Idempotent: one burnout alert per org per ISO week
          const { data: existing } = await supabaseAdmin
            .from('care_events')
            .select('id')
            .eq('org_id', orgId)
            .eq('event_type', 'task')
            .eq('entry_kind', 'system')
            .filter('payload->>burnout_risk', 'eq', 'true')
            .filter('payload->>week_stamp', 'eq', alertWeekStamp)
            .limit(1)

          if (existing && existing.length > 0) {
            logger.info('Burnout alert already exists for user ' + userId + ' week ' + alertWeekStamp + ' — skipping')
            return
          }

          await supabaseAdmin.from('care_events').insert({
            org_id:      orgId,
            // No recipient_id — this is a caregiver wellbeing event, not recipient-scoped
            // recipient_id is nullable on care_events for system events
            event_type:  'task',
            entry_kind:  'system',
            occurred_at: today.toISOString(),
            flagged:     false,
            payload: {
              burnout_risk: true,
              // Omit user_id — care_events is readable by all org members; use burnout.orgSummary for per-user data
              week_stamp:   alertWeekStamp,
              note:         'A caregiver in this org has had high stress scores for 2+ consecutive weeks.',
            },
          })

          totalAlerts++
          logger.info('Burnout alert created for user ' + userId)
        })
      )
    )

    return { alerts: totalAlerts }
  }
)
