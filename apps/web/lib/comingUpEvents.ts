/**
 * UX-097 — pure helper that merges scheduled medications and appointments into
 * a chronologically sorted list of upcoming events for the Daily Brief.
 *
 * Accepts `now: Date` so the function is deterministic and testable.
 */

import { formatClockTime, formatTimeShortLocale } from "@/lib/format";

// ─── Input types ──────────────────────────────────────────────────────────────

type ScheduledMedication = {
  id: string;
  scheduled_time: string; // "HH:MM:SS"
  medications:
    | { drug_name: string; dosage: string }
    | { drug_name: string; dosage: string }[]
    | null;
};

type ScheduledAppointment = {
  id: string;
  starts_at: string; // ISO timestamp
  title: string;
  detail?: string | null;
};

// ─── Output type (matches ComingUpRows props) ─────────────────────────────────

type ComingUpEvent = {
  id: string;
  time: string; // human-readable, e.g. "9:00a"
  label: string;
  detail?: string;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Convert "HH:MM:SS" clock string to minutes-since-midnight for comparison.
 * Returns -1 if unparseable.
 */
function clockToMinutes(hms: string): number {
  const [h, m] = hms.split(":");
  const hour = parseInt(h, 10);
  const min = parseInt(m ?? "0", 10);
  if (Number.isNaN(hour) || Number.isNaN(min)) return -1;
  return hour * 60 + min;
}

/**
 * Current minutes-since-midnight in local time.
 */
function nowMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * midnight of the day after `now` (local time), as a timestamp ms.
 */
function tomorrowMidnightMs(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

/**
 * Resolve the first medication object from the union type.
 */
function resolveMed(
  medications: ScheduledMedication["medications"],
): { drug_name: string; dosage: string } | null {
  if (!medications) return null;
  if (Array.isArray(medications)) return medications[0] ?? null;
  return medications;
}

// ─── Exported helper ──────────────────────────────────────────────────────────

export function comingUpEvents(input: {
  scheduledMeds: ScheduledMedication[];
  appointments: ScheduledAppointment[];
  now: Date;
  limit?: number;
}): ComingUpEvent[] {
  const { scheduledMeds, appointments, now, limit = 5 } = input;
  const currentMinutes = nowMinutes(now);
  const tomorrowMs = tomorrowMidnightMs(now);
  const nowMs = now.getTime();

  const events: Array<ComingUpEvent & { _sortMinutes: number }> = [];

  // ── Medications ────────────────────────────────────────────────────────────
  for (const med of scheduledMeds) {
    const medMinutes = clockToMinutes(med.scheduled_time);
    if (medMinutes < 0 || medMinutes <= currentMinutes) continue;

    const resolved = resolveMed(med.medications);
    const label = resolved
      ? `${resolved.drug_name} ${resolved.dosage}`.trim()
      : "Scheduled dose";

    events.push({
      id: med.id,
      time: formatClockTime(med.scheduled_time),
      label,
      _sortMinutes: medMinutes,
    });
  }

  // ── Appointments ───────────────────────────────────────────────────────────
  for (const appt of appointments) {
    const startsMs = Date.parse(appt.starts_at);
    if (isNaN(startsMs) || startsMs <= nowMs || startsMs >= tomorrowMs) continue;

    // Convert ISO → minutes-since-midnight (local) for sort
    const startsDate = new Date(startsMs);
    const apptMinutes = startsDate.getHours() * 60 + startsDate.getMinutes();

    events.push({
      id: appt.id,
      time: formatTimeShortLocale(appt.starts_at),
      label: appt.title,
      detail: appt.detail ?? undefined,
      _sortMinutes: apptMinutes,
    });
  }

  // ── Sort ascending by time of day, then slice ──────────────────────────────
  events.sort((a, b) => a._sortMinutes - b._sortMinutes);

  return events.slice(0, limit).map(({ _sortMinutes: _ignored, ...rest }) => rest);
}
