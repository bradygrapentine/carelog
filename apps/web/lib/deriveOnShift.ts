/**
 * UX-098 — pure helper that maps shift + member rows into the props expected
 * by `<OnShiftSidebar>`. Accepts `now: Date` for determinism/testability.
 */

import { formatTimeShortLocale, formatMonthDayLocale } from "@/lib/format";

// ─── Input types ──────────────────────────────────────────────────────────────

type ShiftLike = {
  id: string;
  user_id: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
};

type MemberLike = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type LatestMoodInput = {
  // TD-213: this is a derived 3-bucket *shift-status* label, NOT the canonical
  // care-event Mood union in lib/mood.ts (good|okay|difficult|crisis). "steady"
  // is intentional shift-summary vocabulary (a coarser rollup) — do not unify
  // with Mood; they are different domains.
  label: "good" | "steady" | "difficult";
  occurredAt: string; // ISO
  by: string;
  note?: string;
} | null;

// ─── Output types (match OnShiftSidebar props) ────────────────────────────────

type Caregiver = {
  id: string;
  name: string;
  initials: string;
  shiftLabel?: string;
};

type OnShiftSidebarData = {
  onNow: Caregiver | null;
  upNext: Caregiver | null;
  latestMood: {
    label: "good" | "steady" | "difficult";
    note?: string;
    when: string;
    by: string;
  } | null;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildInitials(
  displayName: string | null,
  email: string | null,
): string {
  if (displayName) {
    const words = displayName.trim().split(/\s+/);
    return words
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
  }
  if (email) return email[0]?.toUpperCase() ?? "?";
  return "?";
}

function buildName(displayName: string | null, email: string | null): string {
  return displayName ?? email ?? "Unknown";
}

function buildShiftLabel(startsAt: string, endsAt: string): string {
  return `${formatTimeShortLocale(startsAt)}–${formatTimeShortLocale(endsAt)}`;
}

/**
 * Format an ISO timestamp as a friendly "when" string.
 * Same day as now → just the time. Otherwise → "Apr 30, 2:30 PM" style.
 */
function formatWhen(isoString: string, now: Date): string {
  const d = new Date(isoString);
  const today = now.toDateString();
  const dDay = d.toDateString();

  if (dDay === today) {
    return formatTimeShortLocale(isoString);
  }

  // Check yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dDay === yesterday.toDateString()) {
    return `yesterday, ${formatTimeShortLocale(isoString)}`;
  }

  return `${formatMonthDayLocale(isoString)}, ${formatTimeShortLocale(isoString)}`;
}

// ─── Exported helper ──────────────────────────────────────────────────────────

export function deriveOnShift(input: {
  shifts: ShiftLike[];
  members: MemberLike[];
  latestMood: LatestMoodInput;
  now: Date;
}): OnShiftSidebarData {
  const { shifts, members, latestMood, now } = input;
  const nowMs = now.getTime();

  // Build member lookup
  const memberMap = new Map<string, { name: string; initials: string }>();
  for (const m of members) {
    memberMap.set(m.user_id, {
      name: buildName(m.display_name, m.email),
      initials: buildInitials(m.display_name, m.email),
    });
  }

  // Find onNow: shift where starts_at <= now <= ends_at
  const onNowShift =
    shifts.find((s) => {
      const start = Date.parse(s.starts_at);
      const end = Date.parse(s.ends_at);
      return start <= nowMs && nowMs <= end;
    }) ?? null;

  // Find upNext: shift with smallest starts_at where starts_at > now
  const futureShifts = shifts
    .filter((s) => Date.parse(s.starts_at) > nowMs)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const upNextShift = futureShifts[0] ?? null;

  function resolveCaregiver(s: ShiftLike): Caregiver {
    const member = memberMap.get(s.user_id);
    return {
      id: s.user_id,
      name: member?.name ?? "Unknown",
      initials: member?.initials ?? "?",
      shiftLabel: buildShiftLabel(s.starts_at, s.ends_at),
    };
  }

  // Resolve latestMood
  const resolvedMood: OnShiftSidebarData["latestMood"] = latestMood
    ? {
        label: latestMood.label,
        note: latestMood.note,
        when: formatWhen(latestMood.occurredAt, now),
        by: latestMood.by,
      }
    : null;

  return {
    onNow: onNowShift ? resolveCaregiver(onNowShift) : null,
    upNext: upNextShift ? resolveCaregiver(upNextShift) : null,
    latestMood: resolvedMood,
  };
}
