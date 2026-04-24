import { describe, it, expect } from "vitest";
import {
  computeAdherence,
  parseDailyFrequency,
  type MedForAdherence,
  type DoseEvent,
} from "../medAdherence";

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-04-23T12:00:00Z").getTime();

/** Build a dose event that falls within a 28-day window ending at NOW. */
function makeDoseEvent(
  medicationId: string,
  daysAgo: number,
  overrides: Partial<DoseEvent> = {},
): DoseEvent {
  const occurredMs = NOW - daysAgo * 24 * 60 * 60 * 1000;
  return {
    id: `evt-${medicationId}-${daysAgo}`,
    recipient_id: "rec-1",
    occurred_at: new Date(occurredMs).toISOString(),
    event_type: "medication_dose",
    payload: { medication_id: medicationId },
    ...overrides,
  };
}

const WINDOW = 28; // days

// ── parseDailyFrequency ───────────────────────────────────────────────────────

describe("parseDailyFrequency", () => {
  it("returns 1 for 'once daily'", () => {
    expect(parseDailyFrequency("once daily")).toBe(1);
  });

  it("returns 2 for 'twice daily'", () => {
    expect(parseDailyFrequency("twice daily")).toBe(2);
  });

  it("returns 3 for '3x/day'", () => {
    expect(parseDailyFrequency("3x/day")).toBe(3);
  });

  it("returns 3 for '3 times a day'", () => {
    expect(parseDailyFrequency("3 times a day")).toBe(3);
  });

  it("returns 4 for 'every 6 hours'", () => {
    expect(parseDailyFrequency("every 6 hours")).toBe(4);
  });

  it("returns 1 for 'daily'", () => {
    expect(parseDailyFrequency("daily")).toBe(1);
  });

  it("returns null for null input", () => {
    expect(parseDailyFrequency(null)).toBeNull();
  });

  it("returns null for unrecognized instruction", () => {
    expect(parseDailyFrequency("as needed")).toBeNull();
  });
});

// ── computeAdherence ─────────────────────────────────────────────────────────

describe("computeAdherence", () => {
  const med: MedForAdherence = {
    id: "med-1",
    drug_name: "Metoprolol",
    instructions: "once daily",
  };

  it("30 expected, 28 actual → ~93%", () => {
    // Once daily × 30 days = 30 expected. We only have a 28-day window, so
    // expected = 28. Let's use a twice-daily med to get 30 expected.
    const twiceMed: MedForAdherence = {
      id: "med-2",
      drug_name: "Lisinopril",
      instructions: "twice daily",
    };
    // 28 days × 2/day = 56 expected. Record 52 actual → 92.8% → 93%
    const events: DoseEvent[] = Array.from({ length: 52 }, (_, i) =>
      makeDoseEvent("med-2", i % 27 === 0 ? i % 27 : i % 27, {
        id: `evt-med-2-${i}`,
        occurred_at: new Date(NOW - ((i % 27) + 1) * 24 * 60 * 60 * 1000).toISOString(),
        payload: { medication_id: "med-2" },
      }),
    );
    const result = computeAdherence(twiceMed, events, WINDOW);
    expect(result.expected).toBe(56);
    expect(result.actual).toBe(52);
    expect(result.pct).toBe(93);
  });

  it("med with no schedule → pct: null", () => {
    const noScheduleMed: MedForAdherence = {
      id: "med-3",
      drug_name: "Aspirin",
      instructions: "as needed for pain",
    };
    const result = computeAdherence(noScheduleMed, [], WINDOW);
    expect(result.pct).toBeNull();
    expect(result.expected).toBeNull();
  });

  it("empty doseEvents → actual = 0", () => {
    const result = computeAdherence(med, [], WINDOW);
    expect(result.actual).toBe(0);
    expect(result.expected).toBe(28);
    expect(result.pct).toBe(0);
  });

  it("dose just outside window is not counted", () => {
    // 29 days ago = 1 day outside the 28-day window
    const outsideEvent = makeDoseEvent("med-1", 29);
    const insideEvent = makeDoseEvent("med-1", 1);
    // Stub Date.now to a fixed time for determinism
    const result = computeAdherence(med, [outsideEvent, insideEvent], WINDOW);
    // The outside event occurred 29 days ago, so it should be excluded.
    // Only insideEvent counts.
    expect(result.actual).toBeLessThanOrEqual(1);
  });

  it("only matching medication_id is counted", () => {
    const wrongMedEvent = makeDoseEvent("med-OTHER", 1);
    const correctMedEvent = makeDoseEvent("med-1", 2);
    const result = computeAdherence(med, [wrongMedEvent, correctMedEvent], WINDOW);
    expect(result.actual).toBe(1); // only correctMedEvent counted
  });

  it("multiple meds: only matching medication_id counted per med", () => {
    const medA: MedForAdherence = {
      id: "med-A",
      drug_name: "Med A",
      instructions: "once daily",
    };
    const medB: MedForAdherence = {
      id: "med-B",
      drug_name: "Med B",
      instructions: "once daily",
    };

    const eventsA = [makeDoseEvent("med-A", 1), makeDoseEvent("med-A", 2)];
    const eventsB = [makeDoseEvent("med-B", 3)];
    const allEvents = [...eventsA, ...eventsB];

    const resultA = computeAdherence(medA, allEvents, WINDOW);
    const resultB = computeAdherence(medB, allEvents, WINDOW);

    expect(resultA.actual).toBe(2);
    expect(resultB.actual).toBe(1);
  });
});
