/**
 * Date/time formatting helpers — single source of truth for date display.
 *
 * Two locale conventions are intentionally preserved here, mirroring what the
 * call sites used before extraction:
 *
 *  - "en-US" helpers (formatLongDate, formatShortDate, formatMonthDay,
 *    formatTimeOfDay, formatTimeShort) — explicit US locale; output is stable
 *    across every browser. Used by editorial/export surfaces where the rendered
 *    text needs to match design copy regardless of viewer locale.
 *
 *  - default-locale helpers (formatLocaleDate, formatLocaleDateTime) — pass
 *    through to the browser's locale via `toLocale*String()` with no locale
 *    argument. Used by interior list metadata where a non-US viewer's local
 *    convention is the right thing to render.
 *
 * `formatClockTime` is intentionally separate: it parses an "HH:MM:SS" clock
 * string from the medications schedule, NOT an ISO timestamp.
 */

type Input = string | Date;

function toDate(input: Input): Date {
  return input instanceof Date ? input : new Date(input);
}

/** "April 29, 2026" — long month, day, year, en-US. */
export function formatLongDate(input: Input): string {
  return toDate(input).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "Apr 29, 2026" — short month, day, year, en-US. */
export function formatShortDate(input: Input): string {
  return toDate(input).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Apr 29" — short month + day, no year, en-US. */
export function formatMonthDay(input: Input): string {
  return toDate(input).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * "Apr 29" — short month + day, no year. Uses browser locale (no locale arg)
 * to mirror call sites that originally used `toLocaleDateString([], …)`.
 */
export function formatMonthDayLocale(input: Input): string {
  return toDate(input).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

/**
 * "April 29, 2026" — long month, day, year. Uses browser locale (no locale
 * arg) to mirror call sites that originally used `toLocaleDateString([], …)`.
 */
export function formatLongDateLocale(input: Input): string {
  return toDate(input).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * "Wednesday, April 29" — weekday + long month + day. Uses browser locale.
 * Shared by JournalTimeline's date-section header.
 */
export function formatWeekdayMonthDay(input: Input): string {
  return toDate(input).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * "08:42 AM" — hour and minute, both 2-digit. Uses browser locale (no locale
 * arg) to mirror the call sites this replaces; pass `"en-US"` explicitly via
 * `formatTimeShort` if you need stable output.
 */
export function formatTimeOfDay(input: Input): string {
  return toDate(input).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "8:42 AM" — numeric hour, 2-digit minute, en-US. Used on editorial surfaces. */
export function formatTimeShort(input: Input): string {
  return toDate(input).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * "8:42 AM" — numeric hour, 2-digit minute. Uses browser locale (no locale
 * arg) to mirror shift-surface call sites.
 */
export function formatTimeShortLocale(input: Input): string {
  return toDate(input).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * "Wed, Apr 29, 8:42 AM" — weekday + month + day + time, browser locale.
 * Shared by ShiftPopover's start label.
 */
export function formatShiftStart(input: Input): string {
  return toDate(input).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Browser-locale date — passes through to toLocaleDateString() with no args. */
export function formatLocaleDate(input: Input): string {
  return toDate(input).toLocaleDateString();
}

/** Browser-locale date+time — passes through to toLocaleString() with no args. */
export function formatLocaleDateTime(input: Input): string {
  return toDate(input).toLocaleString();
}

/**
 * Parse an "HH:MM:SS" clock string (from the meds schedule) into a compact
 * label like "8a" / "8:30p". Returns the input unchanged if it cannot be
 * parsed.
 *
 * NOT for ISO timestamps — see formatTimeOfDay / formatTimeShort for those.
 */
export function formatClockTime(hms: string): string {
  const [h, m] = hms.split(":");
  const hour = parseInt(h, 10);
  const min = m;
  if (Number.isNaN(hour) || min == null) return hms;
  const period = hour >= 12 ? "p" : "a";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return min === "00" ? `${hour12}:00${period}` : `${hour12}:${min}${period}`;
}
