import { describe, it, expect } from "vitest";
import { formatCareStats } from "../DashboardClient";

describe("formatCareStats", () => {
  it("returns empty string for 0 events", () => {
    expect(formatCareStats(0, 0)).toBe("");
    expect(formatCareStats(0, 5)).toBe("");
  });

  it("uses singular 'event' for count=1", () => {
    expect(formatCareStats(1, 0)).toBe("1 event · just started");
  });

  it("shows 'just started' when months=0 regardless of event count", () => {
    expect(formatCareStats(5, 0)).toBe("5 events · just started");
    expect(formatCareStats(100, 0)).toBe("100 events · just started");
  });

  it("uses singular 'month' for months=1", () => {
    expect(formatCareStats(10, 1)).toBe("10 events · 1 month");
    expect(formatCareStats(1, 1)).toBe("1 event · 1 month");
  });

  it("uses plural 'months' for months > 1", () => {
    expect(formatCareStats(847, 14)).toBe("847 events · 14 months");
    expect(formatCareStats(2, 2)).toBe("2 events · 2 months");
  });

  it("handles large numbers correctly", () => {
    expect(formatCareStats(9999, 36)).toBe("9999 events · 36 months");
  });
});
