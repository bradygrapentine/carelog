import { describe, it, expect } from "vitest";
import { sleepFromEvents } from "../sleepFromEvents";

type CareEventLike = {
  event_type: string;
  occurred_at: string;
  payload?: { hours?: number; wakes?: number; [key: string]: unknown } | null;
};

// now = 2026-05-01T12:00:00Z
// 7 nights: 2026-04-25 (oldest) … 2026-05-01 (today)
const NOW = new Date("2026-05-01T12:00:00.000Z");

function sleepEvt(
  date: string, // YYYY-MM-DD — use midnight UTC so it lands on that date
  hours?: number,
  wakes?: number,
): CareEventLike {
  return {
    event_type: "sleep",
    occurred_at: `${date}T06:00:00.000Z`, // waking time on that date
    payload: { hours, wakes },
  };
}

describe("sleepFromEvents", () => {
  it("returns exactly 7 nights for a now of 2026-05-01", () => {
    const result = sleepFromEvents([], NOW);
    expect(result).toHaveLength(7);
  });

  it("nights are sorted oldest-first", () => {
    const result = sleepFromEvents([], NOW);
    expect(result[0].date).toBe("2026-04-25");
    expect(result[6].date).toBe("2026-05-01");
  });

  it("event with hours=7 and wakes=2 lands in correct night bucket", () => {
    const events: CareEventLike[] = [sleepEvt("2026-04-28", 7, 2)];
    const result = sleepFromEvents(events, NOW);
    const night = result.find((n) => n.date === "2026-04-28");
    expect(night).toBeDefined();
    expect(night!.hours).toBe(7);
    expect(night!.wakes).toBe(2);
  });

  it("multiple events on same night: uses latest hours, sums wakes", () => {
    // Two sleep events on 2026-04-30 — earlier and later
    const events: CareEventLike[] = [
      {
        event_type: "sleep",
        occurred_at: "2026-04-30T04:00:00.000Z",
        payload: { hours: 5, wakes: 1 },
      },
      {
        event_type: "sleep",
        occurred_at: "2026-04-30T07:00:00.000Z",
        payload: { hours: 6, wakes: 2 },
      },
    ];
    const result = sleepFromEvents(events, NOW);
    const night = result.find((n) => n.date === "2026-04-30");
    expect(night).toBeDefined();
    // Latest event's hours (07:00 is later)
    expect(night!.hours).toBe(6);
    // Wakes summed: 1 + 2 = 3
    expect(night!.wakes).toBe(3);
  });

  it("nights with no event have hours: 0, wakes: 0", () => {
    const result = sleepFromEvents([], NOW);
    for (const night of result) {
      expect(night.hours).toBe(0);
      expect(night.wakes).toBe(0);
    }
  });

  it("events outside the 7-night window are ignored", () => {
    const events: CareEventLike[] = [
      // 8 days ago — outside window
      sleepEvt("2026-04-23", 8, 1),
    ];
    const result = sleepFromEvents(events, NOW);
    for (const night of result) {
      expect(night.hours).toBe(0);
      expect(night.wakes).toBe(0);
    }
  });
});
