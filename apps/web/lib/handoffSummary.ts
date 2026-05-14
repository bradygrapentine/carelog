import type { CareEvent } from "@carelog/types";
import { isJournalEvent, parseMood } from "@/lib/careEvent";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MedsSummary = {
  count: number;
  /** E.g. "12 doses logged: 10 by Maya, 2 by Jordan." */
  description: string;
};

export type MomentItem = {
  actorId: string;
  excerpt: string;
  mood: string | null;
  occurredAt: string;
};

export type MomentsSummary = {
  items: MomentItem[];
  description: string;
};

export type AppointmentsSummary = {
  completed: number;
  upcomingIn24h: number;
  description: string;
};

export type ConcernItem = {
  actorId: string;
  excerpt: string;
  occurredAt: string;
  flagged: boolean;
};

export type ConcernsSummary = {
  hasConcerns: boolean;
  items: ConcernItem[];
  description: string;
};

export type ContributorEntry = {
  actorId: string;
  count: number;
};

export type ThanksSummary = {
  contributors: ContributorEntry[];
  description: string;
  viewerOnly: boolean;
};

export type HandoffSummaryData = {
  windowHours: number;
  meds: MedsSummary;
  moments: MomentsSummary;
  appointments: AppointmentsSummary;
  concerns: ConcernsSummary;
  thanks: ThanksSummary;
};

// ─── Actor name helpers ───────────────────────────────────────────────────────

/**
 * Format a list of actor IDs with counts into plain-language contributor text.
 * Since we only have UUIDs in the pure function (no profiles), the caller may
 * pass a display name map; if none is available we fall back to "Team member".
 */
function formatContributors(
  contributors: ContributorEntry[],
  nameMap?: Record<string, string>,
): string {
  if (contributors.length === 0) return "No contributions in this window.";
  return contributors
    .map((c) => {
      const name = nameMap?.[c.actorId] ?? "Team member";
      return `${name} · ${c.count} ${c.count === 1 ? "entry" : "entries"}`;
    })
    .join(" · ");
}

// ─── Core builder ─────────────────────────────────────────────────────────────

/**
 * Build a plain-language handoff summary from a slice of care events.
 *
 * Pure function — no Supabase, no fetch, no side-effects.
 *
 * @param events  Care events to summarise (may span any window — filter is
 *                applied inside this function using `now` and `windowHours`).
 * @param now     Reference time (pass `new Date()` in production; injectable
 *                for testing).
 * @param windowHours  How many hours back to look (24 | 48 | 72).
 * @param viewerId     The current user's actor_id — used for the "just you"
 *                     check in Thanks.
 * @param actorNameMap Optional map of actor_id → display name for human-
 *                     readable contributor lists.
 */
export function buildHandoffSummary(
  events: CareEvent[],
  now: Date,
  windowHours: number,
  viewerId?: string,
  actorNameMap?: Record<string, string>,
): HandoffSummaryData {
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  // ── 1. Filter to window ──────────────────────────────────────────────────
  const inWindow = events.filter((e) => {
    const ts = new Date(e.occurred_at);
    return ts >= windowStart && ts <= now;
  });

  // ── 2. Meds ──────────────────────────────────────────────────────────────
  const medEvents = inWindow.filter((e) => e.event_type === "medication");
  let medsDescription: string;
  if (medEvents.length === 0) {
    medsDescription = "No medications logged in this window.";
  } else {
    // Tally by actor
    const byActor = new Map<string, number>();
    for (const e of medEvents) {
      byActor.set(e.actor_id, (byActor.get(e.actor_id) ?? 0) + 1);
    }
    const parts = Array.from(byActor.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([actorId, count]) => {
        const name = actorNameMap?.[actorId] ?? "Team member";
        return `${count} by ${name}`;
      });
    medsDescription = `${medEvents.length} ${medEvents.length === 1 ? "dose" : "doses"} logged: ${parts.join(", ")}.`;
  }

  // ── 3. Moments (journal entries, top 3 most recent) ──────────────────────
  const journalEvents = inWindow
    .filter((e) => isJournalEvent(e) && e.entry_kind === "human")
    .sort(
      (a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )
    .slice(0, 3);

  const momentItems: MomentItem[] = journalEvents.map((e) => {
    const je = isJournalEvent(e) ? e : null;
    return {
      actorId: e.actor_id,
      excerpt: je?.payload.text ? je.payload.text.slice(0, 120) : "(no text)",
      mood: parseMood(e.payload?.mood) ?? null,
      occurredAt: e.occurred_at,
    };
  });

  const momentsDescription =
    momentItems.length === 0
      ? "No journal entries in this window."
      : `${momentItems.length} ${momentItems.length === 1 ? "entry" : "entries"} logged.`;

  // ── 4. Appointments ──────────────────────────────────────────────────────
  const apptEvents = inWindow.filter((e) => e.event_type === "appointment");
  const completedAppts = apptEvents.length; // all in-window appointments are treated as completed
  // Upcoming in next 24h — look forward from now
  const next24hEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const upcomingAppts = events.filter((e) => {
    if (e.event_type !== "appointment") return false;
    const ts = new Date(e.occurred_at);
    return ts > now && ts <= next24hEnd;
  });

  let appointmentsDescription: string;
  if (completedAppts === 0 && upcomingAppts.length === 0) {
    appointmentsDescription = "No visits in this window.";
  } else {
    const parts: string[] = [];
    if (completedAppts > 0)
      parts.push(
        `${completedAppts} completed ${completedAppts === 1 ? "visit" : "visits"}`,
      );
    if (upcomingAppts.length > 0)
      parts.push(`${upcomingAppts.length} upcoming in the next 24 h`);
    appointmentsDescription = parts.join(", ") + ".";
  }

  // ── 5. Concerns (symptom events OR flagged events) ───────────────────────
  const concernEvents = inWindow.filter(
    (e) => e.event_type === "symptom" || e.flagged,
  );

  const concernItems: ConcernItem[] = concernEvents.map((e) => ({
    actorId: e.actor_id,
    excerpt:
      isJournalEvent(e) && e.payload.text
        ? e.payload.text.slice(0, 120)
        : e.event_type,
    occurredAt: e.occurred_at,
    flagged: e.flagged,
  }));

  const concernsDescription =
    concernItems.length === 0
      ? "No concerns flagged in this window."
      : `${concernItems.length} ${concernItems.length === 1 ? "concern" : "concerns"} flagged.`;

  // ── 6. Thanks (contributor counts) ───────────────────────────────────────
  const actorCounts = new Map<string, number>();
  for (const e of inWindow) {
    actorCounts.set(e.actor_id, (actorCounts.get(e.actor_id) ?? 0) + 1);
  }

  const contributors: ContributorEntry[] = Array.from(actorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([actorId, count]) => ({ actorId, count }));

  const viewerOnly =
    contributors.length === 1 && contributors[0]?.actorId === viewerId;

  const thanksDescription = viewerOnly
    ? "Just you in this window."
    : contributors.length === 0
      ? "No activity in this window."
      : formatContributors(contributors, actorNameMap);

  return {
    windowHours,
    meds: {
      count: medEvents.length,
      description: medsDescription,
    },
    moments: {
      items: momentItems,
      description: momentsDescription,
    },
    appointments: {
      completed: completedAppts,
      upcomingIn24h: upcomingAppts.length,
      description: appointmentsDescription,
    },
    concerns: {
      hasConcerns: concernItems.length > 0,
      items: concernItems,
      description: concernsDescription,
    },
    thanks: {
      contributors,
      description: thanksDescription,
      viewerOnly,
    },
  };
}
