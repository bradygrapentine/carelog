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

export type MemberLookup = {
  /** `auth.users.id` → display name; null when no name resolved. */
  displayName: (userId: string) => string | null;
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
