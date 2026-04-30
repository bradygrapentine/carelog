/**
 * UX-061 — adapters that turn raw Supabase rows into the props expected by
 * `<MedScheduleStrip>` and `<AdherenceChart>`. Pure functions; no DB or
 * network calls. Time-of-day strings are "HH:MM[:SS]".
 */

import type { AdherenceDay } from "@/components/medications/AdherenceChart";
import type {
  StripDose,
  DoseState,
} from "@/components/medications/MedScheduleStrip";

export type ScheduleRow = {
  id: string;
  medication_id: string;
  time_of_day: string;
  days_of_week: number[];
};

export type MedEvent = {
  occurred_at: string;
  payload: {
    medication_id?: string;
    scheduled_time?: string;
    action?: string;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Build 7 contiguous days ending on `today`, oldest first. For each day:
 * - `expected` = count of schedules whose `days_of_week` array contains that DOW
 * - `taken` = count of `action='given'` care_events occurring on that calendar day
 *
 * The window is bounded by 7 days so older events are dropped silently.
 */
export function buildAdherenceDays(
  schedules: ScheduleRow[],
  events: MedEvent[],
  today: Date = new Date(),
): AdherenceDay[] {
  const startUtcMs = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  const days: AdherenceDay[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const dayMs = startUtcMs - offset * DAY_MS;
    const dayDate = new Date(dayMs);
    const dow = dayDate.getUTCDay();

    const expected = schedules.filter((s) =>
      (s.days_of_week ?? []).includes(dow),
    ).length;

    const taken = events.filter((e) => {
      if (e.payload.action !== "given") return false;
      const ts = Date.parse(e.occurred_at);
      return ts >= dayMs && ts < dayMs + DAY_MS;
    }).length;

    const iso = dayDate.toISOString().slice(0, 10);
    days.push({
      date: iso,
      weekday: WEEKDAY_LABELS[dow],
      taken,
      expected,
    });
  }
  return days;
}

/**
 * Compose dose dots for today's schedule strip. State per dose:
 * - `done`     — a matching `action='given'` event exists for this medication today
 * - `due`      — scheduled time is within ±30 min of `now`
 * - `missed`   — scheduled time is in the past and no `given` event today
 * - `upcoming` — scheduled time is later today
 *
 * Schedules that don't apply to today's DOW are omitted.
 */
export function buildStripDoses(
  schedules: Array<
    ScheduleRow & {
      drug_name?: string;
      dosage?: string;
    }
  >,
  todayEvents: MedEvent[],
  now: Date = new Date(),
): StripDose[] {
  const dow = now.getUTCDay();
  const nowHour = now.getHours() + now.getMinutes() / 60;

  const givenIds = new Set(
    todayEvents
      .filter((e) => e.payload.action === "given")
      .map((e) => e.payload.medication_id)
      .filter((id): id is string => Boolean(id)),
  );

  return schedules
    .filter((s) => (s.days_of_week ?? []).includes(dow))
    .map((s) => {
      const time = s.time_of_day.slice(0, 5);
      const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
      const scheduledHour =
        Number.isFinite(hh) && Number.isFinite(mm) ? hh + mm / 60 : null;

      let state: DoseState;
      if (givenIds.has(s.medication_id)) {
        state = "done";
      } else if (scheduledHour === null) {
        state = "prn";
      } else if (Math.abs(scheduledHour - nowHour) <= 0.5) {
        state = "due";
      } else if (scheduledHour < nowHour) {
        state = "missed";
      } else {
        state = "upcoming";
      }

      const label = s.drug_name
        ? `${s.drug_name}${s.dosage ? ` ${s.dosage}` : ""}`
        : "Scheduled dose";

      return { id: s.id, time, label, state };
    });
}
