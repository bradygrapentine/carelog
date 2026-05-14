/**
 * OOP-005 — unit tests for careEvent.ts type guards and parseMood.
 * ≥ 20 assertions; at least one positive + one negative per exported guard.
 */

import { describe, it, expect } from "vitest";
import {
  isMedicationEvent,
  isJournalEvent,
  isMoodEvent,
  isSymptomEvent,
  isAppointmentEvent,
  isSleepEvent,
  isMedicationDoseGiven,
  parseMood,
} from "../careEvent";
import type { CareEvent } from "@carelog/types";

// ─── Fixture factory ──────────────────────────────────────────────────────────

function makeEvent(
  event_type: string,
  payload: Record<string, unknown> = {},
): CareEvent {
  return {
    id: "evt-001",
    org_id: "org-001",
    recipient_id: "rec-001",
    actor_id: "usr-001",
    event_type: event_type as CareEvent["event_type"],
    entry_kind: "human",
    payload,
    flagged: false,
    occurred_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  };
}

// ─── isMedicationEvent ────────────────────────────────────────────────────────

describe("isMedicationEvent", () => {
  it("returns true for event_type === 'medication'", () => {
    expect(isMedicationEvent(makeEvent("medication"))).toBe(true);
  });

  it("returns false for event_type === 'journal'", () => {
    expect(isMedicationEvent(makeEvent("journal"))).toBe(false);
  });

  it("returns false for event_type === 'sleep'", () => {
    expect(isMedicationEvent(makeEvent("sleep"))).toBe(false);
  });
});

// ─── isJournalEvent ───────────────────────────────────────────────────────────

describe("isJournalEvent", () => {
  it("returns true for event_type === 'journal'", () => {
    expect(
      isJournalEvent(makeEvent("journal", { text: "Feeling better today" })),
    ).toBe(true);
  });

  it("returns false for event_type === 'medication'", () => {
    expect(isJournalEvent(makeEvent("medication"))).toBe(false);
  });
});

// ─── isMoodEvent ─────────────────────────────────────────────────────────────

describe("isMoodEvent", () => {
  it("returns true for event_type === 'mood'", () => {
    expect(isMoodEvent(makeEvent("mood"))).toBe(true);
  });

  it("returns false for event_type === 'journal'", () => {
    expect(isMoodEvent(makeEvent("journal"))).toBe(false);
  });
});

// ─── isSymptomEvent ───────────────────────────────────────────────────────────

describe("isSymptomEvent", () => {
  it("returns true for event_type === 'symptom'", () => {
    expect(isSymptomEvent(makeEvent("symptom"))).toBe(true);
  });

  it("returns false for event_type === 'appointment'", () => {
    expect(isSymptomEvent(makeEvent("appointment"))).toBe(false);
  });
});

// ─── isAppointmentEvent ───────────────────────────────────────────────────────

describe("isAppointmentEvent", () => {
  it("returns true for event_type === 'appointment'", () => {
    expect(isAppointmentEvent(makeEvent("appointment"))).toBe(true);
  });

  it("returns false for event_type === 'task'", () => {
    expect(isAppointmentEvent(makeEvent("task"))).toBe(false);
  });
});

// ─── isSleepEvent ─────────────────────────────────────────────────────────────

describe("isSleepEvent", () => {
  it("returns true for event_type === 'sleep'", () => {
    expect(isSleepEvent(makeEvent("sleep", { hours: 7, wakes: 2 }))).toBe(true);
  });

  it("returns false for event_type === 'journal'", () => {
    expect(isSleepEvent(makeEvent("journal", { hours: 7 }))).toBe(false);
  });

  it("returns false for event_type === 'medication'", () => {
    expect(isSleepEvent(makeEvent("medication"))).toBe(false);
  });
});

// ─── isMedicationDoseGiven ───────────────────────────────────────────────────

describe("isMedicationDoseGiven", () => {
  it("returns true when event_type='medication' and action='given'", () => {
    expect(
      isMedicationDoseGiven(makeEvent("medication", { action: "given" })),
    ).toBe(true);
  });

  it("returns false when event_type='medication' and action='missed'", () => {
    expect(
      isMedicationDoseGiven(makeEvent("medication", { action: "missed" })),
    ).toBe(false);
  });

  it("returns false when event_type='medication' and action is absent", () => {
    expect(isMedicationDoseGiven(makeEvent("medication", {}))).toBe(false);
  });

  it("returns false when event_type is not 'medication'", () => {
    expect(
      isMedicationDoseGiven(makeEvent("journal", { action: "given" })),
    ).toBe(false);
  });
});

// ─── parseMood ────────────────────────────────────────────────────────────────

describe("parseMood", () => {
  it("returns 'good' for the string 'good'", () => {
    expect(parseMood("good")).toBe("good");
  });

  it("returns 'okay' for the string 'okay'", () => {
    expect(parseMood("okay")).toBe("okay");
  });

  it("returns 'difficult' for the string 'difficult'", () => {
    expect(parseMood("difficult")).toBe("difficult");
  });

  it("returns 'crisis' for the string 'crisis'", () => {
    expect(parseMood("crisis")).toBe("crisis");
  });

  it("returns null for an unrecognised string", () => {
    expect(parseMood("happy")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseMood("")).toBeNull();
  });

  it("returns null for a number", () => {
    expect(parseMood(42)).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseMood(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseMood(undefined)).toBeNull();
  });

  it("returns null for an object", () => {
    expect(parseMood({ mood: "good" })).toBeNull();
  });
});
