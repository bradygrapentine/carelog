/**
 * UX-062 — pure adapters that turn a raw `shifts` list + `members` lookup
 * into the props expected by the UX-058 layout primitives.
 *
 * No DB access, no React hooks. Each function is deterministic given a
 * `now` instant.
 */

import type { Shift } from "@/components/shifts/ShiftCalendar";
import type { ShiftLanesProps } from "@/components/shifts/ShiftLanes";
import type {
  TeamMember,
  TeamMemberStatus,
} from "@/components/shifts/TeamNowBoard";
import type { ShiftBlock } from "@/components/shifts/ShiftWeekGrid";

export type MemberLookup = {
  /** `auth.users.id` → display name; null when no name resolved. */
  displayName: (userId: string) => string | null;
  /** Optional: raw email for the user — used as local-part fallback when displayName is null. */
  email?: (userId: string) => string | null;
};

/** Bands used by the lanes view — coarse 24h day buckets. */
export const SHIFT_BANDS = [
  { label: "Day 8a–2p", startHour: 8, endHour: 14 },
  { label: "Aft 2p–6p", startHour: 14, endHour: 18 },
  { label: "Eve 6p–10p", startHour: 18, endHour: 22 },
  { label: "Night 10p–8a", startHour: 22, endHour: 32 },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const local = startOfDay(d);
  const dow = local.getDay();
  const monOffset = (dow + 6) % 7;
  local.setDate(local.getDate() - monOffset);
  return local;
}

function shiftHourRange(s: Shift): { startHour: number; endHour: number } {
  const start = new Date(s.start_at);
  const end = new Date(s.end_at);
  const startHour = start.getHours() + start.getMinutes() / 60;
  let endHour = end.getHours() + end.getMinutes() / 60;
  // shifts that cross midnight: end is on the next day → push past 24
  if (end.getTime() > startOfDay(start).getTime() + DAY_MS) {
    endHour += 24;
  } else if (endHour <= startHour) {
    endHour += 24;
  }
  return { startHour, endHour };
}

function bandIndexFor(startHour: number): number {
  for (let i = 0; i < SHIFT_BANDS.length; i++) {
    const b = SHIFT_BANDS[i];
    if (startHour >= b.startHour && startHour < b.endHour) return i;
  }
  // Fallback: night band absorbs anything before 8a
  return SHIFT_BANDS.length - 1;
}

/**
 * Build a 7-day swim-lane view anchored on the Monday of `now`'s week.
 * Each cell is the *first* assigned name found in that day/band; null
 * when no shift fills the slot.
 */
export function buildShiftLanesData(
  shifts: Shift[],
  lookup: MemberLookup,
  now: Date = new Date(),
): ShiftLanesProps {
  const weekStart = startOfWeek(now);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const wd = WEEKDAY_LABELS[d.getDay()];
    days.push(`${wd} ${d.getDate()}`);
  }

  const todayStart = startOfDay(now).getTime();
  const todayIndex = Math.floor((todayStart - weekStart.getTime()) / DAY_MS);
  const inThisWeek = todayIndex >= 0 && todayIndex < 7;

  const nowHour = now.getHours() + now.getMinutes() / 60;
  let liveBandIndex = -1;
  if (inThisWeek) liveBandIndex = bandIndexFor(nowHour);

  const assignments: (string | null)[][] = SHIFT_BANDS.map(() =>
    Array<string | null>(7).fill(null),
  );

  for (const s of shifts) {
    if (s.status === "cancelled") continue;
    const start = new Date(s.start_at);
    const dayIndex = Math.floor(
      (startOfDay(start).getTime() - weekStart.getTime()) / DAY_MS,
    );
    if (dayIndex < 0 || dayIndex >= 7) continue;
    const { startHour } = shiftHourRange(s);
    const bandIdx = bandIndexFor(startHour);
    if (assignments[bandIdx][dayIndex] !== null) continue;
    const name = s.assignee_user_id
      ? (lookup.displayName(s.assignee_user_id) ?? "Unassigned")
      : null;
    assignments[bandIdx][dayIndex] = name;
  }

  return {
    days,
    bands: SHIFT_BANDS.map((b) => b.label),
    assignments,
    todayIndex: inThisWeek ? todayIndex : -1,
    liveBandIndex,
  };
}

/**
 * Group team members by current shift status (on / next / later / off).
 *
 * - `on`    — the member has an active shift covering `now`
 * - `next`  — soonest upcoming shift starting later today
 * - `later` — has any shift later today after the `next` one
 * - `off`   — no shift today
 *
 * Members without any shift today still appear in the `off` bucket so the
 * board reflects the whole team, not just those on rotation.
 */
export function buildTeamNowBoard(
  shifts: Shift[],
  members: Array<{
    user_id: string;
    display_name: string | null;
    email: string | null;
  }>,
  now: Date = new Date(),
): TeamMember[] {
  const dayStart = startOfDay(now).getTime();
  const dayEnd = dayStart + DAY_MS;
  const nowMs = now.getTime();

  const byUser = new Map<string, Shift[]>();
  for (const s of shifts) {
    if (s.status === "cancelled" || !s.assignee_user_id) continue;
    const start = new Date(s.start_at).getTime();
    const end = new Date(s.end_at).getTime();
    if (end <= dayStart || start >= dayEnd) continue;
    const list = byUser.get(s.assignee_user_id) ?? [];
    list.push(s);
    byUser.set(s.assignee_user_id, list);
  }

  function fmtTime(d: Date): string {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "p" : "a";
    const hour12 = h % 12 || 12;
    if (m === 0) return `${hour12}${ampm}`;
    return `${hour12}:${String(m).padStart(2, "0")}${ampm}`;
  }

  const result: TeamMember[] = [];
  for (const m of members) {
    const name = m.display_name ?? m.email ?? "Unknown";
    const todays = (byUser.get(m.user_id) ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );

    let status: TeamMemberStatus = "off";
    let detail: string | undefined;

    if (todays.length === 0) {
      status = "off";
      detail = "No shift today";
    } else {
      const active = todays.find((s) => {
        const start = new Date(s.start_at).getTime();
        const end = new Date(s.end_at).getTime();
        return nowMs >= start && nowMs < end;
      });
      if (active) {
        status = "on";
        detail = `${fmtTime(new Date(active.start_at))}–${fmtTime(
          new Date(active.end_at),
        )}`;
      } else {
        const upcoming = todays.filter(
          (s) => new Date(s.start_at).getTime() > nowMs,
        );
        if (upcoming.length > 0) {
          // earliest upcoming → next; everyone with later shifts gets demoted to "later"
          status = "next";
          detail = `Up at ${fmtTime(new Date(upcoming[0].start_at))}`;
        } else {
          status = "off";
          detail = "Done for today";
        }
      }
    }

    result.push({ id: m.user_id, name, status, detail });
  }

  // Demote second-or-later "next" members → "later" so only the soonest
  // member sits in the `next` bucket. Aligns with the prototype's intent
  // of "Up next" being a singleton.
  const upcomingByStart = members
    .map((m) => {
      const todays = byUser.get(m.user_id) ?? [];
      const future = todays
        .map((s) => new Date(s.start_at).getTime())
        .filter((t) => t > nowMs);
      return future.length > 0
        ? { user_id: m.user_id, soonest: Math.min(...future) }
        : null;
    })
    .filter((x): x is { user_id: string; soonest: number } => x !== null)
    .sort((a, b) => a.soonest - b.soonest);

  if (upcomingByStart.length > 1) {
    const keepNext = upcomingByStart[0].user_id;
    for (const r of result) {
      if (r.status === "next" && r.id !== keepNext) {
        r.status = "later";
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stable color palette for ShiftWeekGrid blocks (one token per caregiver).
// ---------------------------------------------------------------------------
const CAREGIVER_COLORS = [
  "var(--color-primary-subtle)",
  "var(--color-secondary-subtle)",
  "var(--color-tertiary-subtle)",
] as const;

/**
 * Deterministic hash — maps a caregiverId string to an index into
 * CAREGIVER_COLORS so the same caregiver always gets the same color.
 */
function caregiverColorIndex(caregiverId: string): number {
  let h = 0;
  for (let i = 0; i < caregiverId.length; i++) {
    h = (h * 31 + caregiverId.charCodeAt(i)) >>> 0;
  }
  return h % CAREGIVER_COLORS.length;
}

type RawShift = {
  id: string;
  assignee_user_id: string | null;
  start_at: string;
  end_at: string;
};

/**
 * Build a flat `ShiftBlock[]` for the Week tab of ShiftsPanel.
 *
 * - Drops unassigned shifts (null `assignee_user_id`).
 * - Drops shifts outside `[weekStart, weekStart + 7d)`.
 * - Midnight-crossing shifts split into two consecutive blocks.
 * - Resolves caregiver name via `lookup.displayName`; falls back to
 *   email local-part (via `lookup.email` if provided), then "Unknown caregiver".
 * - Assigns a stable color per caregiver via `CAREGIVER_COLORS` hash.
 * - Returns blocks sorted ascending by (day, startHour).
 */
export function buildShiftWeekGridBlocks(
  shifts: RawShift[],
  lookup: MemberLookup,
  weekStart: Date,
): ShiftBlock[] {
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekStartMs + 7 * DAY_MS;

  const blocks: ShiftBlock[] = [];

  for (const s of shifts) {
    if (!s.assignee_user_id) continue;

    const startDate = new Date(s.start_at);
    const endDate = new Date(s.end_at);
    const startMs = startDate.getTime();

    // Drop shifts that start outside this week's window
    if (startMs < weekStartMs || startMs >= weekEndMs) continue;

    const caregiverId = s.assignee_user_id;
    const color = CAREGIVER_COLORS[caregiverColorIndex(caregiverId)];

    // Resolve caregiver name — PHI: never expose raw email if display_name is set
    const displayName = lookup.displayName(caregiverId);
    let caregiverName: string;
    if (displayName !== null) {
      caregiverName = displayName;
    } else {
      const rawEmail = lookup.email ? lookup.email(caregiverId) : null;
      if (rawEmail) {
        caregiverName = rawEmail.split("@")[0];
      } else {
        caregiverName = "Unknown caregiver";
      }
    }

    const startHour = startDate.getHours() + startDate.getMinutes() / 60;
    const endHour = endDate.getHours() + endDate.getMinutes() / 60;

    // Compute day index (0=Mon … 6=Sun) for the shift's start day
    const startDayStart = startOfDay(startDate).getTime();
    const dayIndex = Math.floor((startDayStart - weekStartMs) / DAY_MS) as
      | 0
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6;

    const crossesMidnight =
      endDate.getTime() > startOfDay(startDate).getTime() + DAY_MS;

    if (crossesMidnight && dayIndex < 6) {
      // Split: first block covers start → midnight (24)
      blocks.push({
        id: `${s.id}-day0`,
        caregiverId,
        caregiverName,
        caregiverColor: color,
        day: dayIndex,
        startHour,
        endHour: 24,
      });
      // Second block covers midnight (0) → end of shift on next day
      blocks.push({
        id: `${s.id}-day1`,
        caregiverId,
        caregiverName,
        caregiverColor: color,
        day: (dayIndex + 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        startHour: 0,
        endHour: endHour <= 0 ? endHour + 24 : endHour,
      });
    } else {
      blocks.push({
        id: s.id,
        caregiverId,
        caregiverName,
        caregiverColor: color,
        day: dayIndex,
        startHour,
        endHour: endHour <= startHour ? endHour + 24 : endHour,
      });
    }
  }

  // Sort ascending by (day, startHour)
  return blocks.sort((a, b) => a.day - b.day || a.startHour - b.startHour);
}
