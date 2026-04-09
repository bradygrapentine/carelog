import { inngest } from '../client'
import { supabaseAdmin } from '../../server/supabaseAdmin.server'

// ─── pure detection logic (testable without Inngest) ─────────────────────────

export interface MedicationRow {
  id:                    string
  org_id:                string
  recipient_id:          string
  drug_name:             string
  supply_days_remaining: number
}

export function detectLowSupply(medications: MedicationRow[]): MedicationRow[] {
  return medications.filter(m => m.supply_days_remaining <= 7)
}

// ─── Inngest function ─────────────────────────────────────────────────────────

export const refillAlert = inngest.createFunction(
  { id: 'refill-alert' },
  { cron: 'TZ=UTC 0 7 * * *' }, // Daily at 7am UTC (1 hour after gap detector)
  async ({ step, logger }) => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    // Step 1: fetch all active medications with low supply
    const allMedications = await step.run('fetch-low-supply-medications', async () => {
      const { data, error } = await supabaseAdmin
        .from('medications')
        .select('id, org_id, recipient_id, drug_name, supply_days_remaining')
        .eq('active', true)
        .lte('supply_days_remaining', 7)

      if (error) throw new Error('Query failed: ' + error.message)
      return (data ?? []) as MedicationRow[]
    })

    logger.info('Low supply medications found: ' + allMedications.length)
    if (allMedications.length === 0) return { alerts: 0 }

    let totalAlerts = 0

    await Promise.all(
      allMedications.map(med =>
        step.run('alert-' + med.id, async () => {
          const todayStart = todayStr + 'T00:00:00Z'

          // Idempotent: check if we already created a refill alert for this medication today
          const { data: existing } = await supabaseAdmin
            .from('care_events')
            .select('id')
            .eq('org_id', med.org_id)
            .eq('recipient_id', med.recipient_id)
            .eq('event_type', 'task')
            .eq('entry_kind', 'system')
            .filter('payload->>refill_needed', 'eq', 'true')
            .filter('payload->>medication_id', 'eq', med.id)
            .gte('occurred_at', todayStart)
            .limit(1)

          if (existing && existing.length > 0) {
            logger.info('Refill alert already exists for medication ' + med.id + ' today — skipping')
            return
          }

          await supabaseAdmin.from('care_events').insert({
            org_id:       med.org_id,
            recipient_id: med.recipient_id,
            event_type:   'task',
            entry_kind:   'system',
            occurred_at:  today.toISOString(),
            flagged:      false,
            payload: {
              refill_needed:         true,
              medication_id:         med.id,
              drug_name:             med.drug_name,
              days_remaining:        med.supply_days_remaining,
            },
          })

          totalAlerts++
          logger.info('Refill alert created for ' + med.drug_name + ' (' + med.supply_days_remaining + ' days left)')
        })
      )
    )

    return { alerts: totalAlerts }
  }
)
