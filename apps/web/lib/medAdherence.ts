/**
 * Medication adherence calculation helpers.
 *
 * Pure functions — no side effects, no DB access. Safe to use in tests.
 */

/** Minimal shape of a medication row needed for adherence computation. */
export type MedForAdherence = {
  id: string
  drug_name: string
  /** e.g. "twice daily", "once daily", "3x/day" — used to derive expected doses */
  instructions: string | null
}

/** Minimal shape of a care_events row that represents a dose event. */
export type DoseEvent = {
  id: string
  recipient_id: string
  /** ISO timestamp */
  occurred_at: string
  event_type: string
  /** JSON payload — we check for medication_id */
  payload: Record<string, unknown>
}

export type AdherenceResult = {
  actual: number
  expected: number | null
  pct: number | null
}

/**
 * Parse daily dose frequency from an instructions string.
 * Returns null when the frequency cannot be determined.
 */
export function parseDailyFrequency(instructions: string | null): number | null {
  if (!instructions) return null
  const normalized = instructions.toLowerCase().trim()

  // Explicit "N times" patterns — e.g. "3 times a day", "3x/day", "3x daily"
  const nTimesMatch = normalized.match(/(\d+)\s*(?:times?|x)\s*(?:\/|a\s*|per\s*)?day/)
  if (nTimesMatch) return parseInt(nTimesMatch[1], 10)

  // "twice" / "two times"
  if (/\btwice\b|\btwo\s*times?\b/.test(normalized)) return 2

  // "once" / "one time"
  if (/\bonce\b|\bone\s*time?\b/.test(normalized)) return 1

  // "every N hours" → 24/N
  const everyHoursMatch = normalized.match(/every\s+(\d+)\s*hours?/)
  if (everyHoursMatch) {
    const hours = parseInt(everyHoursMatch[1], 10)
    if (hours > 0 && hours <= 24) return Math.round(24 / hours)
  }

  // "daily" / "once daily" / "every day"
  if (/\bdaily\b|\bevery\s*day\b/.test(normalized)) return 1

  return null
}

/**
 * Compute medication adherence over a rolling window ending now.
 *
 * @param med           Medication to evaluate
 * @param doseEvents    All care_events for the recipient (filtered to dose events)
 * @param windowDays    Number of days to look back (e.g. 28)
 *
 * @returns {actual}   Number of dose events actually recorded in the window
 * @returns {expected} Expected doses in the window; null when schedule unavailable
 * @returns {pct}      Adherence percentage (0–100); null when expected is null
 */
export function computeAdherence(
  med: MedForAdherence,
  doseEvents: DoseEvent[],
  windowDays: number,
): AdherenceResult {
  const now = Date.now()
  const windowStart = now - windowDays * 24 * 60 * 60 * 1000

  // Count actual dose events for this medication within the window.
  // The payload must contain medication_id matching med.id.
  const actual = doseEvents.filter((e) => {
    const occurredMs = new Date(e.occurred_at).getTime()
    if (occurredMs < windowStart || occurredMs > now) return false
    return (
      e.event_type === 'medication_dose' &&
      (e.payload as Record<string, unknown>)['medication_id'] === med.id
    )
  }).length

  // Derive expected doses from the instructions field.
  const dailyFreq = parseDailyFrequency(med.instructions)
  if (dailyFreq === null) {
    return { actual, expected: null, pct: null }
  }

  const expected = dailyFreq * windowDays
  const pct = expected === 0 ? null : Math.round((actual / expected) * 100)

  return { actual, expected, pct }
}
