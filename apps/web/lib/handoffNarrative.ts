/**
 * handoffNarrative.ts — UX-065
 *
 * Pure functions that summarise a prior-shift event list into three
 * one-line narrative strings: sleep, meds, and schedule.
 *
 * Constraints (hard):
 *  - No Date.now(), no Math.random(), no I/O.
 *  - Never throws — returns "No <category> recorded" for empty or
 *    malformed input.
 *  - Deterministic: same input → same output always.
 */

import type { JournalEvent } from "../types/journal";

// ─── Internal helpers ──────────────────────────────────────────────────────

// TD-213: validates the generic care-event shape (id/event_type/occurred_at),
// NOT journal-specificity. Named distinctly from the exported `isJournalEvent`
// in lib/careEvent.ts (which IS journal-specific) to kill the prior collision.
function isCareEventLike(e: unknown): e is JournalEvent {
  if (!e || typeof e !== "object") return false;
  const obj = e as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["event_type"] === "string" &&
    typeof obj["occurred_at"] === "string"
  );
}

function safeEvents(events: unknown): JournalEvent[] {
  if (!Array.isArray(events)) return [];
  return events.filter(isCareEventLike);
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Summarise sleep-related events.
 *
 * Uses journal events whose payload contains mood "difficult" as a proxy for
 * disrupted sleep, plus any journal entries recorded between midnight and
 * 6 a.m. (UTC) as overnight-activity signals.
 *
 * Returns "No sleep activity recorded" for empty/invalid input.
 */
export function summarizeSleep(events: unknown): string {
  try {
    const safe = safeEvents(events);
    if (safe.length === 0) return "No sleep activity recorded";

    const journalEvents = safe.filter((e) => e.event_type === "journal");
    if (journalEvents.length === 0) return "No sleep activity recorded";

    const overnightEntries = journalEvents.filter((e) => {
      // occurred_at is Supabase timestamptz (ISO 8601 with Z or offset);
      // getUTCHours() normalizes to UTC, so the 0–6 window is UTC-anchored
      // regardless of caregiver locale.
      const h = new Date(e.occurred_at).getUTCHours();
      return h >= 0 && h < 6;
    });

    const difficultMoodEntries = journalEvents.filter(
      (e) => e.payload?.mood === "difficult",
    );

    const overnightCount = overnightEntries.length;
    const difficultCount = difficultMoodEntries.length;

    if (overnightCount === 0 && difficultCount === 0) {
      return `${journalEvents.length} journal ${journalEvents.length === 1 ? "entry" : "entries"} logged; no disruptions noted`;
    }

    const parts: string[] = [];
    if (overnightCount > 0) {
      parts.push(
        `${overnightCount} overnight ${overnightCount === 1 ? "entry" : "entries"}`,
      );
    }
    if (difficultCount > 0) {
      parts.push(
        `${difficultCount} difficult-mood ${difficultCount === 1 ? "moment" : "moments"} noted`,
      );
    }
    return parts.join("; ");
  } catch {
    return "No sleep activity recorded";
  }
}

/**
 * Summarise medication events.
 *
 * Counts total medication events. Returns "No medications recorded" when
 * none exist.
 */
export function summarizeMeds(events: unknown): string {
  try {
    const safe = safeEvents(events);
    if (safe.length === 0) return "No medications recorded";

    const medEvents = safe.filter((e) => e.event_type === "medication");
    if (medEvents.length === 0) return "No medications recorded";

    const given = medEvents.filter((e) => e.entry_kind !== "missed");
    const missed = medEvents.filter((e) => e.entry_kind === "missed");

    const parts: string[] = [];
    if (given.length > 0) {
      parts.push(
        `${given.length} ${given.length === 1 ? "dose" : "doses"} given`,
      );
    }
    if (missed.length > 0) {
      parts.push(
        `${missed.length} ${missed.length === 1 ? "dose" : "doses"} missed`,
      );
    }

    return parts.length > 0
      ? parts.join("; ")
      : `${medEvents.length} ${medEvents.length === 1 ? "dose" : "doses"} logged`;
  } catch {
    return "No medications recorded";
  }
}

/**
 * Summarise schedule/appointment events.
 *
 * Counts appointment events. Returns "No schedule activity recorded" when
 * none exist.
 */
export function summarizeSchedule(events: unknown): string {
  try {
    const safe = safeEvents(events);
    if (safe.length === 0) return "No schedule activity recorded";

    const apptEvents = safe.filter((e) => e.event_type === "appointment");
    const shiftEvents = safe.filter((e) => e.event_type === "shift");
    const taskEvents = safe.filter((e) => e.event_type === "task");

    const total = apptEvents.length + shiftEvents.length + taskEvents.length;
    if (total === 0) return "No schedule activity recorded";

    const parts: string[] = [];
    if (apptEvents.length > 0) {
      parts.push(
        `${apptEvents.length} ${apptEvents.length === 1 ? "appointment" : "appointments"}`,
      );
    }
    if (shiftEvents.length > 0) {
      parts.push(
        `${shiftEvents.length} ${shiftEvents.length === 1 ? "shift" : "shifts"}`,
      );
    }
    if (taskEvents.length > 0) {
      parts.push(
        `${taskEvents.length} ${taskEvents.length === 1 ? "task" : "tasks"}`,
      );
    }

    return parts.join(", ");
  } catch {
    return "No schedule activity recorded";
  }
}
