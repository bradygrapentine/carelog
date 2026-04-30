import { describe, it, expect } from "vitest";
import {
  buildAdherenceDays,
  buildStripDoses,
  type ScheduleRow,
  type MedEvent,
} from "../medAdherenceFromEvents";

const MED_A = "11111111-1111-1111-1111-111111111111";
const MED_B = "22222222-2222-2222-2222-222222222222";

function sched(
  overrides: Partial<ScheduleRow> & {
    drug_name?: string;
    dosage?: string;
  } = {},
): ScheduleRow & { drug_name?: string; dosage?: string } {
  return {
    id: overrides.id ?? "s1",
    medication_id: overrides.medication_id ?? MED_A,
    time_of_day: overrides.time_of_day ?? "08:00:00",
    days_of_week: overrides.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
    drug_name: overrides.drug_name,
    dosage: overrides.dosage,
  };
}

function evt(
  overrides: {
    occurred_at?: string;
    medication_id?: string;
    action?: string;
  } = {},
): MedEvent {
  return {
    occurred_at: overrides.occurred_at ?? "2026-04-30T08:30:00.000Z",
    payload: {
      medication_id: overrides.medication_id ?? MED_A,
      action: overrides.action ?? "given",
    },
  };
}

describe("buildAdherenceDays", () => {
  const today = new Date("2026-04-30T12:00:00.000Z"); // Thursday (DOW=4)

  it("returns 7 entries oldest-first ending today", () => {
    const days = buildAdherenceDays([], [], today);
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe("2026-04-24");
    expect(days[6].date).toBe("2026-04-30");
  });

  it("expected counts schedules whose days_of_week contains that DOW", () => {
    // Schedule active only on Thursday (DOW=4) and one always-active.
    const schedules = [
      sched({ id: "s1", days_of_week: [4] }),
      sched({ id: "s2" }),
    ];
    const days = buildAdherenceDays(schedules, [], today);
    // 2026-04-24 Fri DOW=5 → only s2 (1)
    // 2026-04-30 Thu DOW=4 → both (2)
    expect(days[0].expected).toBe(1);
    expect(days[6].expected).toBe(2);
  });

  it("taken counts only events with action='given' on that calendar day", () => {
    const events = [
      evt({ occurred_at: "2026-04-30T08:30:00.000Z", action: "given" }),
      evt({ occurred_at: "2026-04-30T20:00:00.000Z", action: "given" }),
      evt({ occurred_at: "2026-04-30T09:00:00.000Z", action: "skipped" }),
      evt({ occurred_at: "2026-04-29T09:00:00.000Z", action: "given" }),
    ];
    const days = buildAdherenceDays([sched()], events, today);
    expect(days[6].taken).toBe(2);
    expect(days[5].taken).toBe(1);
  });

  it("emits valid weekday labels", () => {
    const days = buildAdherenceDays([], [], today);
    expect(days[6].weekday).toBe("Thu");
    expect(days[0].weekday).toBe("Fri");
  });
});

describe("buildStripDoses", () => {
  // Thursday DOW=4, current time 12:00 local
  const noon = new Date(2026, 3, 30, 12, 0, 0);

  it("filters schedules to today's DOW only", () => {
    const wedOnly = sched({
      id: "wed",
      days_of_week: [3],
      time_of_day: "08:00:00",
    });
    const everyDay = sched({ id: "all", days_of_week: [0, 1, 2, 3, 4, 5, 6] });
    const doses = buildStripDoses([wedOnly, everyDay], [], noon);
    expect(doses.map((d) => d.id)).toEqual(["all"]);
  });

  it("marks dose 'done' when a 'given' event exists for the medication", () => {
    const morning = sched({
      id: "s",
      time_of_day: "08:00:00",
      medication_id: MED_A,
    });
    const doses = buildStripDoses(
      [morning],
      [evt({ medication_id: MED_A, action: "given" })],
      noon,
    );
    expect(doses[0].state).toBe("done");
  });

  it("marks past dose 'missed' when no given event", () => {
    const past = sched({ time_of_day: "08:00:00" });
    const doses = buildStripDoses([past], [], noon);
    expect(doses[0].state).toBe("missed");
  });

  it("marks future dose 'upcoming'", () => {
    const future = sched({ time_of_day: "20:00:00" });
    const doses = buildStripDoses([future], [], noon);
    expect(doses[0].state).toBe("upcoming");
  });

  it("marks dose 'due' within ±30 min of now", () => {
    const nowish = sched({ time_of_day: "12:15:00" });
    const doses = buildStripDoses([nowish], [], noon);
    expect(doses[0].state).toBe("due");
  });

  it("normalizes time_of_day to HH:MM and includes drug label", () => {
    const s = sched({
      time_of_day: "08:30:00",
      drug_name: "Levo",
      dosage: "50mcg",
    });
    const doses = buildStripDoses([s], [], noon);
    expect(doses[0].time).toBe("08:30");
    expect(doses[0].label).toBe("Levo 50mcg");
  });
});
