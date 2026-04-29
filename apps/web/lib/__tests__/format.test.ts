import { describe, it, expect } from "vitest";
import {
  formatLongDate,
  formatLongDateLocale,
  formatShortDate,
  formatMonthDay,
  formatMonthDayLocale,
  formatWeekdayMonthDay,
  formatTimeOfDay,
  formatTimeShort,
  formatTimeShortLocale,
  formatShiftStart,
  formatLocaleDate,
  formatLocaleDateTime,
  formatClockTime,
} from "../format";

// Pinned to a deterministic UTC instant so the timezone of CI doesn't drift the
// expected strings. The day-of-month assertions tolerate timezone offsets by
// pinning to mid-day UTC where possible.
const SAMPLE_ISO = "2026-04-29T15:42:00Z";

describe("format helpers (en-US, locale-stable)", () => {
  it("formatLongDate produces 'April 29, 2026'", () => {
    expect(formatLongDate(SAMPLE_ISO)).toBe("April 29, 2026");
  });

  it("formatShortDate produces 'Apr 29, 2026'", () => {
    expect(formatShortDate(SAMPLE_ISO)).toBe("Apr 29, 2026");
  });

  it("formatMonthDay produces 'Apr 29'", () => {
    expect(formatMonthDay(SAMPLE_ISO)).toBe("Apr 29");
  });

  it("formatTimeShort produces a numeric-hour AM/PM label", () => {
    // 15:42 UTC formats to a 12-hour clock; exact value depends on TZ.
    // Assert shape: "<n>:42 AM|PM" or similar.
    expect(formatTimeShort(SAMPLE_ISO)).toMatch(
      /^\d{1,2}:\d{2}\s?(AM|PM)$/i,
    );
  });

  it("accepts a Date instance as well as a string", () => {
    expect(formatLongDate(new Date(SAMPLE_ISO))).toBe("April 29, 2026");
  });
});

// ─── TD-95 snapshot assertions ───────────────────────────────────────────────
// These lock the en-US Intl.DateTimeFormat output to be byte-identical with
// the TD-88 toLocaleDateString / toLocaleTimeString output for en-US.
// The fixture is chosen at 15:42 UTC so it remains Apr 29 in UTC±12h windows.
//
// Note: formatTimeShort depends on the host timezone; we assert shape here
// instead of an exact string (same as the legacy test above).

describe("TD-95: en-US Intl.DateTimeFormat snapshot — byte-identical to TD-88 output", () => {
  const FIXTURE = new Date("2026-04-29T15:42:00Z");

  it("formatLongDate matches expected en-US long format", () => {
    expect(formatLongDate(FIXTURE)).toBe("April 29, 2026");
  });

  it("formatShortDate matches expected en-US short format", () => {
    expect(formatShortDate(FIXTURE)).toBe("Apr 29, 2026");
  });

  it("formatMonthDay matches expected en-US month+day format", () => {
    expect(formatMonthDay(FIXTURE)).toBe("Apr 29");
  });

  it("formatTimeShort matches numeric-hour AM/PM pattern (en-US, TZ-aware)", () => {
    // Shape assertion: <1-2 digit hour>:<2 digit minute> AM/PM
    expect(formatTimeShort(FIXTURE)).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i);
  });
});

describe("format helpers (browser-default locale)", () => {
  // These use `[]` locale, so exact output depends on the runtime ICU locale.
  // We assert shape, not exact strings, to keep tests stable across CI hosts.
  it("formatLongDateLocale returns a non-empty string", () => {
    expect(formatLongDateLocale(SAMPLE_ISO)).toMatch(/2026/);
  });

  it("formatMonthDayLocale returns a non-empty string", () => {
    expect(formatMonthDayLocale(SAMPLE_ISO)).toBeTruthy();
  });

  it("formatWeekdayMonthDay returns a non-empty string", () => {
    expect(formatWeekdayMonthDay(SAMPLE_ISO)).toBeTruthy();
  });

  it("formatTimeOfDay returns a 2-digit hour:minute label", () => {
    expect(formatTimeOfDay(SAMPLE_ISO)).toMatch(/\d{2}:\d{2}/);
  });

  it("formatTimeShortLocale returns a numeric-hour:minute label", () => {
    expect(formatTimeShortLocale(SAMPLE_ISO)).toMatch(/\d{1,2}:\d{2}/);
  });

  it("formatShiftStart returns weekday + time label", () => {
    expect(formatShiftStart(SAMPLE_ISO)).toBeTruthy();
  });

  it("formatLocaleDate returns a non-empty string", () => {
    expect(formatLocaleDate(SAMPLE_ISO)).toBeTruthy();
  });

  it("formatLocaleDateTime returns a non-empty string", () => {
    expect(formatLocaleDateTime(SAMPLE_ISO)).toBeTruthy();
  });
});

describe("formatClockTime (HH:MM:SS schedule strings, NOT ISO)", () => {
  it("formats 8 AM as '8a'", () => {
    expect(formatClockTime("08:00:00")).toBe("8:00a");
  });

  it("formats 8:30 AM as '8:30a'", () => {
    expect(formatClockTime("08:30:00")).toBe("8:30a");
  });

  it("formats noon as '12:00p'", () => {
    expect(formatClockTime("12:00:00")).toBe("12:00p");
  });

  it("formats midnight as '12:00a'", () => {
    expect(formatClockTime("00:00:00")).toBe("12:00a");
  });

  it("formats 8:30 PM as '8:30p'", () => {
    expect(formatClockTime("20:30:00")).toBe("8:30p");
  });

  it("returns input unchanged on unparseable strings", () => {
    expect(formatClockTime("nope")).toBe("nope");
  });
});
