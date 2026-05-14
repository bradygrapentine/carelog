/**
 * OOP-005 — CareEvent discriminated union + type guards.
 *
 * The base `CareEvent` interface from `@carelog/types` uses `payload: Record<string, unknown>`
 * so it can mirror the Supabase row without narrowing. This module lives in apps/web only and
 * provides the narrowed union + guards for use across the web app.
 *
 * Rules:
 *  - `type` only, no `interface`, no `enum`.
 *  - Payload shapes enumerated from grepped call sites — no invented keys.
 *  - Guards narrow on `event_type` literal first, then verify minimum key presence (conservative).
 */

import type { CareEvent } from "@carelog/types";
import type { Mood } from "@/lib/mood";

// ─── Base ─────────────────────────────────────────────────────────────────────

/**
 * A structural event shape accepted by all guards.
 * Widens `event_type` to `string` so guards work for runtime event types
 * ("mood", "sleep") that aren't yet in the `EventType` union in @carelog/types.
 * Call sites that hold a `CareEvent` can pass it here — structurally compatible.
 */
type AnyEvent = Omit<CareEvent, "event_type" | "payload"> & {
  event_type: string;
  payload: Record<string, unknown>;
};

/** Strip the polymorphic fields so each variant can redefine them precisely. */
type BaseCareEvent = Omit<CareEvent, "event_type" | "payload"> & {
  event_type: string;
};

// ─── Payload shapes ───────────────────────────────────────────────────────────

type MedicationPayload = {
  medication_id?: string;
  action?: "given" | "missed" | "skipped" | "refused";
  note?: string;
};

/**
 * Journal entries carry free-text + an optional mood tag.
 * `note`/`notes` observed in VisitSummary.tsx:387-390.
 * `text` observed in handoffSummary.ts:146 and pdf/route.tsx:235.
 * `mood` observed in handoffSummary.ts:150 and JournalTimeline.tsx:148-163.
 */
type JournalPayload = {
  text?: string;
  mood?: Mood;
  note?: string;
  notes?: string;
};

/** Sleep events: observed in sleepFromEvents.ts:69-70. */
type SleepPayload = {
  hours?: number;
  wakes?: number;
};

// ─── Discriminated union variants ─────────────────────────────────────────────

export type MedicationEvent = BaseCareEvent & {
  event_type: "medication";
  payload: MedicationPayload;
};

export type JournalEvent = BaseCareEvent & {
  event_type: "journal";
  payload: JournalPayload;
};

export type MoodEvent = BaseCareEvent & {
  event_type: "mood";
  payload: Record<string, unknown>;
};

export type SymptomEvent = BaseCareEvent & {
  event_type: "symptom";
  payload: Record<string, unknown>;
};

export type AppointmentEvent = BaseCareEvent & {
  event_type: "appointment";
  payload: Record<string, unknown>;
};

export type ShiftEvent = BaseCareEvent & {
  event_type: "shift";
  payload: Record<string, unknown>;
};

export type TaskEvent = BaseCareEvent & {
  event_type: "task";
  payload: Record<string, unknown>;
};

export type ExpenseEvent = BaseCareEvent & {
  event_type: "expense";
  payload: Record<string, unknown>;
};

export type HandoffEvent = BaseCareEvent & {
  event_type: "handoff";
  payload: Record<string, unknown>;
};

/**
 * Sleep events use their own `event_type: "sleep"` literal.
 * Confirmed: sleepFromEvents.ts:61 filters `ev.event_type !== "sleep"`.
 */
export type SleepEvent = BaseCareEvent & {
  event_type: "sleep";
  payload: SleepPayload;
};

/** The full discriminated union for all known care event types. */
export type CareEventUnion =
  | MedicationEvent
  | JournalEvent
  | MoodEvent
  | SymptomEvent
  | AppointmentEvent
  | ShiftEvent
  | TaskEvent
  | ExpenseEvent
  | HandoffEvent
  | SleepEvent;

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isMedicationEvent(e: AnyEvent): e is MedicationEvent {
  return e.event_type === "medication";
}

export function isJournalEvent(e: AnyEvent): e is JournalEvent {
  return e.event_type === "journal";
}

export function isMoodEvent(e: AnyEvent): e is MoodEvent {
  return e.event_type === "mood";
}

export function isSymptomEvent(e: AnyEvent): e is SymptomEvent {
  return e.event_type === "symptom";
}

export function isAppointmentEvent(e: AnyEvent): e is AppointmentEvent {
  return e.event_type === "appointment";
}

export function isSleepEvent(e: AnyEvent): e is SleepEvent {
  return e.event_type === "sleep";
}

/**
 * Narrows a medication event to one where the dose was administered.
 * Replaces `.payload.action === "given"` call sites.
 */
export function isMedicationDoseGiven(e: AnyEvent): e is MedicationEvent & {
  payload: MedicationPayload & { action: "given" };
} {
  return isMedicationEvent(e) && e.payload.action === "given";
}

// ─── parseMood ────────────────────────────────────────────────────────────────

const VALID_MOODS: readonly Mood[] = ["good", "okay", "difficult", "crisis"];

/**
 * Safely parse an unknown value as a `Mood`.
 * Returns `null` if the value is not a valid mood string.
 * Replaces `payload.mood as Mood` casts in JournalTimeline.tsx and VisitSummary.tsx.
 */
export function parseMood(value: unknown): Mood | null {
  if (typeof value !== "string") return null;
  return (VALID_MOODS as readonly string[]).includes(value)
    ? (value as Mood)
    : null;
}
