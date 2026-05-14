/**
 * UX-096 — pure helper that transforms raw care_events rows into the
 * SleepNight[] shape consumed by <SleepSparkline>.
 *
 * No Date.now() calls inside — caller passes `now` so this function is
 * deterministic and testable.
 */

export type CareEventLike = {
  event_type: string;
  occurred_at: string; // ISO timestamp
  payload?: {
    hours?: number;
    wakes?: number;
    [key: string]: unknown;
  } | null;
};

/** Extract a numeric payload field, returning 0 for absent/non-numeric values. */
function numericPayload(
  payload: CareEventLike["payload"],
  key: "hours" | "wakes",
): number {
  const v = payload?.[key];
  return Number.isFinite(v) ? (v as number) : 0;
}

export type SleepNight = {
  date: string; // YYYY-MM-DD for the waking date
  hours: number;
  wakes: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Derive the 7-night window (today, today-1, ..., today-6) from `now`,
 * bucket matching sleep events, and return exactly 7 SleepNight entries
 * sorted oldest-first.
 *
 * Multi-event rule: if more than one sleep event falls on the same waking
 * date, the latest event's `hours` value is used (last write wins), and
 * `wakes` values are summed across all events for that night.
 */
export function sleepFromEvents(
  events: CareEventLike[],
  now: Date,
): SleepNight[] {
  // Build the 7 night-dates (YYYY-MM-DD) oldest → newest
  const todayUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  const nightDates: string[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const dayMs = todayUtcMs - offset * DAY_MS;
    const d = new Date(dayMs);
    nightDates.push(d.toISOString().slice(0, 10));
  }

  const nightSet = new Set(nightDates);

  // Accumulate per-night data
  type Accumulator = { latestTs: number; hours: number; totalWakes: number };
  const buckets = new Map<string, Accumulator>();

  for (const ev of events) {
    if (ev.event_type !== "sleep") continue;

    const ts = Date.parse(ev.occurred_at);
    if (!isFinite(ts)) continue;

    const date = new Date(ts).toISOString().slice(0, 10);
    if (!nightSet.has(date)) continue;

    const hours = numericPayload(ev.payload, "hours");
    const wakes = numericPayload(ev.payload, "wakes");

    const existing = buckets.get(date);
    if (!existing) {
      buckets.set(date, { latestTs: ts, hours, totalWakes: wakes });
    } else {
      // Use latest event's hours; sum wakes across all events
      const useHours = ts > existing.latestTs ? hours : existing.hours;
      const latestTs = ts > existing.latestTs ? ts : existing.latestTs;
      buckets.set(date, {
        latestTs,
        hours: useHours,
        totalWakes: existing.totalWakes + wakes,
      });
    }
  }

  return nightDates.map((date) => {
    const bucket = buckets.get(date);
    return {
      date,
      hours: bucket?.hours ?? 0,
      wakes: bucket?.totalWakes ?? 0,
    };
  });
}
