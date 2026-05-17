import { describe, it, expect } from "vitest";
import {
  summarizeSleep,
  summarizeMeds,
  summarizeSchedule,
} from "../handoffNarrative";
import type { JournalEvent } from "../../types/journal";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeEvent(
  overrides: Partial<JournalEvent> & Pick<JournalEvent, "event_type">,
): JournalEvent {
  return {
    id: "test-id",
    entry_kind: "human",
    occurred_at: "2026-05-17T10:00:00Z",
    flagged: false,
    actor_id: "actor-1",
    payload: {},
    ...overrides,
  };
}

function makeOvernightEvent(
  overrides: Partial<JournalEvent> & Pick<JournalEvent, "event_type">,
): JournalEvent {
  return makeEvent({
    ...overrides,
    occurred_at: "2026-05-17T02:30:00Z", // 2:30 AM UTC
  });
}

// ─── summarizeSleep ────────────────────────────────────────────────────────

describe("summarizeSleep", () => {
  it("returns fallback for zero events", () => {
    expect(summarizeSleep([])).toBe("No sleep activity recorded");
  });

  it("returns fallback for empty array (no journal events)", () => {
    expect(summarizeSleep([makeEvent({ event_type: "medication" })])).toBe(
      "No sleep activity recorded",
    );
  });

  it("returns fallback for malformed payload (non-array)", () => {
    expect(summarizeSleep(null)).toBe("No sleep activity recorded");
    expect(summarizeSleep("not-an-array")).toBe("No sleep activity recorded");
    expect(summarizeSleep(undefined)).toBe("No sleep activity recorded");
  });

  it("returns fallback for array with invalid objects — graceful", () => {
    expect(summarizeSleep([null, undefined, 42, "str"])).toBe(
      "No sleep activity recorded",
    );
  });

  it("single journal event during daytime — no disruption note", () => {
    const result = summarizeSleep([makeEvent({ event_type: "journal" })]);
    expect(result).toContain("1 journal entry logged");
    expect(result).not.toContain("overnight entries");
    expect(result).not.toContain("difficult-mood");
  });

  it("single overnight journal event surfaces overnight count", () => {
    const result = summarizeSleep([
      makeOvernightEvent({ event_type: "journal" }),
    ]);
    expect(result).toContain("1 overnight entry");
  });

  it("multiple overnight entries aggregate correctly", () => {
    const result = summarizeSleep([
      makeOvernightEvent({ event_type: "journal" }),
      makeOvernightEvent({ event_type: "journal" }),
      makeOvernightEvent({ event_type: "journal" }),
    ]);
    expect(result).toContain("3 overnight entries");
  });

  it("difficult mood entries are surfaced", () => {
    const result = summarizeSleep([
      makeEvent({ event_type: "journal", payload: { mood: "difficult" } }),
    ]);
    expect(result).toContain("difficult-mood");
  });

  it("overnight + difficult mood combines into one string", () => {
    const result = summarizeSleep([
      makeOvernightEvent({
        event_type: "journal",
        payload: { mood: "difficult" },
      }),
    ]);
    expect(result).toContain("overnight");
    expect(result).toContain("difficult-mood");
  });
});

// ─── summarizeMeds ─────────────────────────────────────────────────────────

describe("summarizeMeds", () => {
  it("returns fallback for zero events", () => {
    expect(summarizeMeds([])).toBe("No medications recorded");
  });

  it("returns fallback when no medication events", () => {
    expect(summarizeMeds([makeEvent({ event_type: "journal" })])).toBe(
      "No medications recorded",
    );
  });

  it("returns fallback for malformed payload", () => {
    expect(summarizeMeds(null)).toBe("No medications recorded");
    expect(summarizeMeds({ not: "array" })).toBe("No medications recorded");
  });

  it("gracefully handles invalid event objects in array", () => {
    expect(summarizeMeds([null, { id: 1 }, "garbage"])).toBe(
      "No medications recorded",
    );
  });

  it("single given dose", () => {
    const result = summarizeMeds([
      makeEvent({ event_type: "medication", entry_kind: "human" }),
    ]);
    expect(result).toContain("1 dose given");
  });

  it("multiple given doses — plural", () => {
    const result = summarizeMeds([
      makeEvent({ event_type: "medication", entry_kind: "human" }),
      makeEvent({ event_type: "medication", entry_kind: "human" }),
      makeEvent({ event_type: "medication", entry_kind: "human" }),
    ]);
    expect(result).toContain("3 doses given");
  });

  it("counts missed doses correctly", () => {
    const result = summarizeMeds([
      makeEvent({ event_type: "medication", entry_kind: "missed" }),
      makeEvent({ event_type: "medication", entry_kind: "missed" }),
    ]);
    expect(result).toContain("2 doses missed");
  });

  it("given + missed doses both appear in output", () => {
    const result = summarizeMeds([
      makeEvent({ event_type: "medication", entry_kind: "human" }),
      makeEvent({ event_type: "medication", entry_kind: "human" }),
      makeEvent({ event_type: "medication", entry_kind: "missed" }),
    ]);
    expect(result).toContain("2 doses given");
    expect(result).toContain("1 dose missed");
  });

  it("deterministic — same input same output", () => {
    const events = [
      makeEvent({ event_type: "medication", entry_kind: "human" }),
      makeEvent({ event_type: "medication", entry_kind: "missed" }),
    ];
    expect(summarizeMeds(events)).toBe(summarizeMeds(events));
  });
});

// ─── summarizeSchedule ─────────────────────────────────────────────────────

describe("summarizeSchedule", () => {
  it("returns fallback for zero events", () => {
    expect(summarizeSchedule([])).toBe("No schedule activity recorded");
  });

  it("returns fallback when no schedule-related events", () => {
    expect(summarizeSchedule([makeEvent({ event_type: "journal" })])).toBe(
      "No schedule activity recorded",
    );
  });

  it("returns fallback for malformed payload", () => {
    expect(summarizeSchedule(null)).toBe("No schedule activity recorded");
    expect(summarizeSchedule(42)).toBe("No schedule activity recorded");
  });

  it("gracefully handles partial/invalid entries in array", () => {
    expect(summarizeSchedule([undefined, {}, "bad"])).toBe(
      "No schedule activity recorded",
    );
  });

  it("single appointment", () => {
    const result = summarizeSchedule([
      makeEvent({ event_type: "appointment" }),
    ]);
    expect(result).toContain("1 appointment");
  });

  it("multiple appointments — plural", () => {
    const result = summarizeSchedule([
      makeEvent({ event_type: "appointment" }),
      makeEvent({ event_type: "appointment" }),
    ]);
    expect(result).toContain("2 appointments");
  });

  it("shift events are included", () => {
    const result = summarizeSchedule([makeEvent({ event_type: "shift" })]);
    expect(result).toContain("1 shift");
  });

  it("task events are included", () => {
    const result = summarizeSchedule([makeEvent({ event_type: "task" })]);
    expect(result).toContain("1 task");
  });

  it("mixed schedule events aggregate", () => {
    const result = summarizeSchedule([
      makeEvent({ event_type: "appointment" }),
      makeEvent({ event_type: "shift" }),
      makeEvent({ event_type: "task" }),
      makeEvent({ event_type: "task" }),
    ]);
    expect(result).toContain("1 appointment");
    expect(result).toContain("1 shift");
    expect(result).toContain("2 tasks");
  });

  it("deterministic — same input same output", () => {
    const events = [
      makeEvent({ event_type: "appointment" }),
      makeEvent({ event_type: "shift" }),
    ];
    expect(summarizeSchedule(events)).toBe(summarizeSchedule(events));
  });
});
