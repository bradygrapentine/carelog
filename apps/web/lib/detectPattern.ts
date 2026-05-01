/**
 * UX-099 — pure helper that inspects care_events from the past 14 days and
 * surfaces the single most pattern-worthy signal as a Pattern object (or null
 * if nothing crosses the detection threshold).
 *
 * No Date.now() inside — caller passes `now` for determinism.
 *
 * Priority order: med-misses > sleep > mood.
 */

export type CareEventLike = {
  event_type: string;
  occurred_at: string; // ISO timestamp
  payload?: {
    mood?: string;
    missed?: boolean;
    hours?: number;
    [key: string]: unknown;
  } | null;
};

export type Pattern = {
  eyebrow: string; // always "PATTERN · 7-day"
  headline: string;
  detail: string; // 1–2 plain-language sentences with actual numbers
  trend?: "up" | "down" | "flat";
};

const DAY_MS = 24 * 60 * 60 * 1000;
const EYEBROW = "PATTERN · 7-day";

function windowBounds(now: Date): {
  past7Start: number;
  past7End: number;
  prior7Start: number;
  prior7End: number;
} {
  const todayEnd = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1, // exclusive upper bound (start of tomorrow)
  );
  const past7Start = todayEnd - 7 * DAY_MS;
  const prior7Start = past7Start - 7 * DAY_MS;

  return {
    past7Start,
    past7End: todayEnd,
    prior7Start,
    prior7End: past7Start,
  };
}

function inWindow(ts: number, start: number, end: number): boolean {
  return ts >= start && ts < end;
}

/**
 * Detect a medication-miss surge.
 * Triggers when: past-7d misses ≥ 2 AND ≥ 50% increase over prior-7d.
 */
function checkMedMisses(
  events: CareEventLike[],
  bounds: ReturnType<typeof windowBounds>,
): Pattern | null {
  let past = 0;
  let prior = 0;

  for (const ev of events) {
    if (ev.event_type !== "medication") continue;
    if (!ev.payload?.missed) continue;
    const ts = Date.parse(ev.occurred_at);
    if (!isFinite(ts)) continue;
    if (inWindow(ts, bounds.past7Start, bounds.past7End)) past++;
    else if (inWindow(ts, bounds.prior7Start, bounds.prior7End)) prior++;
  }

  const increase = prior === 0 ? past : (past - prior) / prior;
  if (past >= 2 && (prior === 0 || increase >= 0.5)) {
    const detail =
      prior === 0
        ? `${past} missed dose${past !== 1 ? "s" : ""} this week, compared to none the week before.`
        : `${past} missed dose${past !== 1 ? "s" : ""} this week vs ${prior} the week before — a ${Math.round(increase * 100)}% increase.`;
    return {
      eyebrow: EYEBROW,
      headline: "Medication misses are rising",
      detail,
      trend: "up",
    };
  }
  return null;
}

/**
 * Detect a sleep dip.
 * Triggers when: past-7d average drops ≥ 1 hour vs prior-7d average.
 */
function checkSleepDip(
  events: CareEventLike[],
  bounds: ReturnType<typeof windowBounds>,
): Pattern | null {
  const pastHours: number[] = [];
  const priorHours: number[] = [];

  for (const ev of events) {
    if (ev.event_type !== "sleep") continue;
    const hours = ev.payload?.hours;
    if (typeof hours !== "number") continue;
    const ts = Date.parse(ev.occurred_at);
    if (!isFinite(ts)) continue;
    if (inWindow(ts, bounds.past7Start, bounds.past7End)) pastHours.push(hours);
    else if (inWindow(ts, bounds.prior7Start, bounds.prior7End))
      priorHours.push(hours);
  }

  if (pastHours.length === 0 || priorHours.length === 0) return null;

  const pastAvg = pastHours.reduce((a, b) => a + b, 0) / pastHours.length;
  const priorAvg = priorHours.reduce((a, b) => a + b, 0) / priorHours.length;
  const drop = priorAvg - pastAvg;

  if (drop >= 1) {
    return {
      eyebrow: EYEBROW,
      headline: "Sleep dipped this week",
      detail: `Average sleep this week was ${pastAvg.toFixed(1)} h, down from ${priorAvg.toFixed(1)} h the previous week — a drop of ${drop.toFixed(1)} h.`,
      trend: "down",
    };
  }
  return null;
}

/**
 * Detect a clustering of difficult-mood days.
 * Triggers when: past-7d difficult count ≥ 3 AND ≥ 50% increase over prior-7d.
 */
function checkMoodCluster(
  events: CareEventLike[],
  bounds: ReturnType<typeof windowBounds>,
): Pattern | null {
  let past = 0;
  let prior = 0;

  for (const ev of events) {
    if (ev.event_type !== "mood") continue;
    if (ev.payload?.mood !== "difficult") continue;
    const ts = Date.parse(ev.occurred_at);
    if (!isFinite(ts)) continue;
    if (inWindow(ts, bounds.past7Start, bounds.past7End)) past++;
    else if (inWindow(ts, bounds.prior7Start, bounds.prior7End)) prior++;
  }

  const increase = prior === 0 ? past : (past - prior) / prior;
  if (past >= 3 && (prior === 0 || increase >= 0.5)) {
    const detail =
      prior === 0
        ? `${past} difficult day${past !== 1 ? "s" : ""} logged this week, compared to none the week before.`
        : `${past} difficult day${past !== 1 ? "s" : ""} this week vs ${prior} the week before — a ${Math.round(increase * 100)}% increase.`;
    return {
      eyebrow: EYEBROW,
      headline: "Difficult days are clustering",
      detail,
      trend: "up",
    };
  }
  return null;
}

/**
 * Return the single most pattern-worthy signal from the past 7 days,
 * or null if nothing crosses a detection threshold.
 *
 * Priority: med-misses > sleep dip > mood cluster.
 */
export function detectPattern(
  events: CareEventLike[],
  now: Date,
): Pattern | null {
  const bounds = windowBounds(now);

  return (
    checkMedMisses(events, bounds) ??
    checkSleepDip(events, bounds) ??
    checkMoodCluster(events, bounds) ??
    null
  );
}
