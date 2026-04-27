// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  belowDeliveryThreshold,
  computeWeekStamp,
  type DeliveryMetrics,
} from "../digestDeliveryMonitor";

describe("belowDeliveryThreshold", () => {
  it("returns false when org_count is 0 (nothing to deliver)", () => {
    const m: DeliveryMetrics = { org_count: 0, success_count: 0 };
    expect(belowDeliveryThreshold(m)).toBe(false);
  });

  it("returns false when success rate is exactly 80%", () => {
    const m: DeliveryMetrics = { org_count: 10, success_count: 8 };
    expect(belowDeliveryThreshold(m)).toBe(false);
  });

  it("returns true when success rate is below 80%", () => {
    const m: DeliveryMetrics = { org_count: 10, success_count: 7 };
    expect(belowDeliveryThreshold(m)).toBe(true);
  });

  it("returns false when success rate is 100%", () => {
    const m: DeliveryMetrics = { org_count: 5, success_count: 5 };
    expect(belowDeliveryThreshold(m)).toBe(false);
  });

  it("returns true when success_count is 0 and org_count > 0", () => {
    const m: DeliveryMetrics = { org_count: 10, success_count: 0 };
    expect(belowDeliveryThreshold(m)).toBe(true);
  });

  it("returns true when just below 80% boundary (79.9%)", () => {
    // 79 / 100 = 79%
    const m: DeliveryMetrics = { org_count: 100, success_count: 79 };
    expect(belowDeliveryThreshold(m)).toBe(true);
  });
});

describe("computeWeekStamp", () => {
  it("returns correct ISO week for a known Monday", () => {
    // 2026-04-20 is a Monday in W17
    const d = new Date("2026-04-20T10:00:00Z");
    expect(computeWeekStamp(d)).toBe("2026-W17");
  });

  it("returns the same week for Sunday (end of ISO week)", () => {
    // 2026-04-26 is a Sunday — still in W17
    const d = new Date("2026-04-26T23:59:00Z");
    expect(computeWeekStamp(d)).toBe("2026-W17");
  });

  it("returns W01 for the first ISO week of a year", () => {
    // 2026-01-01 is a Thursday — ISO W01
    const d = new Date("2026-01-01T00:00:00Z");
    expect(computeWeekStamp(d)).toBe("2026-W01");
  });
});
