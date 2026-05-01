import { describe, it, expect } from "vitest";
import { detectPattern } from "../detectPattern";

type CareEventLike = {
  event_type: string;
  occurred_at: string;
  payload?: {
    mood?: string;
    missed?: boolean;
    hours?: number;
    [key: string]: unknown;
  } | null;
};

// now = 2026-05-01T12:00:00Z
// past 7d: 2026-04-24..2026-05-01
// prior 7d: 2026-04-17..2026-04-23
const NOW = new Date("2026-05-01T12:00:00.000Z");

function medMiss(daysAgo: number): CareEventLike {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return {
    event_type: "medication",
    occurred_at: d.toISOString(),
    payload: { missed: true },
  };
}

function sleepEvt(daysAgo: number, hours: number): CareEventLike {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return {
    event_type: "sleep",
    occurred_at: d.toISOString(),
    payload: { hours },
  };
}

function moodEvt(daysAgo: number, mood: string): CareEventLike {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return {
    event_type: "mood",
    occurred_at: d.toISOString(),
    payload: { mood },
  };
}

describe("detectPattern", () => {
  it("returns null when no events", () => {
    expect(detectPattern([], NOW)).toBeNull();
  });

  it("detects med-miss surge: 3 misses in past 7d, 0 in prior → med-miss pattern with trend up", () => {
    const events: CareEventLike[] = [medMiss(1), medMiss(2), medMiss(3)];
    const result = detectPattern(events, NOW);
    expect(result).not.toBeNull();
    expect(result!.eyebrow).toBe("PATTERN · 7-day");
    expect(result!.trend).toBe("up");
    expect(result!.headline.toLowerCase()).toMatch(/med|miss/);
  });

  it("detects sleep dip: avg 6h past, avg 7.5h prior → sleep pattern with trend down", () => {
    const events: CareEventLike[] = [
      // past 7d: 6h avg (3 events × 6h)
      sleepEvt(1, 6),
      sleepEvt(2, 6),
      sleepEvt(3, 6),
      // prior 7d: 7.5h avg (2 events)
      sleepEvt(8, 7.5),
      sleepEvt(9, 7.5),
    ];
    const result = detectPattern(events, NOW);
    expect(result).not.toBeNull();
    expect(result!.eyebrow).toBe("PATTERN · 7-day");
    expect(result!.trend).toBe("down");
    expect(result!.headline.toLowerCase()).toMatch(/sleep/);
  });

  it("detects difficult-mood cluster: 4 difficult in past, 1 in prior → mood pattern with trend up", () => {
    const events: CareEventLike[] = [
      moodEvt(1, "difficult"),
      moodEvt(2, "difficult"),
      moodEvt(3, "difficult"),
      moodEvt(4, "difficult"),
      moodEvt(9, "difficult"),
    ];
    const result = detectPattern(events, NOW);
    expect(result).not.toBeNull();
    expect(result!.eyebrow).toBe("PATTERN · 7-day");
    expect(result!.trend).toBe("up");
    expect(result!.headline.toLowerCase()).toMatch(/difficult|mood/);
  });

  it("priority: when both med-miss and sleep dip trigger, returns med-miss", () => {
    const events: CareEventLike[] = [
      // med misses trigger
      medMiss(1),
      medMiss(2),
      medMiss(3),
      // sleep dip also triggers
      sleepEvt(1, 5),
      sleepEvt(2, 5),
      sleepEvt(8, 7.5),
      sleepEvt(9, 7.5),
    ];
    const result = detectPattern(events, NOW);
    expect(result).not.toBeNull();
    expect(result!.headline.toLowerCase()).toMatch(/med|miss/);
  });

  it("returns null when changes are below threshold", () => {
    const events: CareEventLike[] = [
      // Only 1 med miss in past 7d (below threshold of ≥2)
      medMiss(1),
      // Sleep: small drop of 0.5h (below ≥1h threshold)
      sleepEvt(1, 7),
      sleepEvt(8, 7.5),
      // Only 2 difficult moods in past (below threshold of ≥3)
      moodEvt(1, "difficult"),
      moodEvt(2, "difficult"),
    ];
    expect(detectPattern(events, NOW)).toBeNull();
  });
});
