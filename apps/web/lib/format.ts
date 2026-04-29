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
 *
 * TD-95: All helpers now use module-level cached Intl.DateTimeFormat instances
 * with explicit options for consistent, performant formatting. en-US helpers
 * are byte-identical to prior TD-88 output (snapshot-tested).
 *
 * Locale-default formatters (formatMonthDayLocale, formatLongDateLocale,
 * formatWeekdayMonthDay, formatTimeOfDay, formatTimeShortLocale,
 * formatShiftStart) are cached at module load time with `undefined` locale.
 * This is safe for SSR (locale is stable per request). For client-side use,
 * the locale is fixed at the time the module is first imported — acceptable
 * because Carelog does not support mid-session locale switching.
 */

type Input = string | Date;

function toDate(input: Input): Date {
  return input instanceof Date ? input : new Date(input);
}

// ─── en-US cached formatters ────────────────────────────────────────────────

const _longDateUS = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const _shortDateUS = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const _monthDayUS = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const _timeShortUS = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

// ─── locale-default cached formatters ───────────────────────────────────────
// Cached at module-load time (locale is undefined → runtime default).
// Safe for SSR and for client bundles where locale is stable across a session.

const _monthDayLocale = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const _longDateLocale = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const _weekdayMonthDayLocale = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const _timeOfDayLocale = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const _timeShortLocale = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const _shiftStartLocale = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// formatLocaleDate: Intl.DateTimeFormat(undefined) with no options matches
// toLocaleDateString() with no args — both use the locale's default date format.
const _localeDateLocale = new Intl.DateTimeFormat(undefined);

// ─── exported helpers ────────────────────────────────────────────────────────

/** "April 29, 2026" — long month, day, year, en-US. */
export function formatLongDate(input: Input): string {
  return _longDateUS.format(toDate(input));
}

/** "Apr 29, 2026" — short month, day, year, en-US. */
export function formatShortDate(input: Input): string {
  return _shortDateUS.format(toDate(input));
}

/** "Apr 29" — short month + day, no year, en-US. */
export function formatMonthDay(input: Input): string {
  return _monthDayUS.format(toDate(input));
}

/**
 * "Apr 29" — short month + day, no year. Uses browser locale (no locale arg)
 * to mirror call sites that originally used `toLocaleDateString([], …)`.
 */
export function formatMonthDayLocale(input: Input): string {
  return _monthDayLocale.format(toDate(input));
}

/**
 * "April 29, 2026" — long month, day, year. Uses browser locale (no locale
 * arg) to mirror call sites that originally used `toLocaleDateString([], …)`.
 */
export function formatLongDateLocale(input: Input): string {
  return _longDateLocale.format(toDate(input));
}

/**
 * "Wednesday, April 29" — weekday + long month + day. Uses browser locale.
 * Shared by JournalTimeline's date-section header.
 */
export function formatWeekdayMonthDay(input: Input): string {
  return _weekdayMonthDayLocale.format(toDate(input));
}

/**
 * "08:42 AM" — hour and minute, both 2-digit. Uses browser locale (no locale
 * arg) to mirror the call sites this replaces; pass `"en-US"` explicitly via
 * `formatTimeShort` if you need stable output.
 */
export function formatTimeOfDay(input: Input): string {
  return _timeOfDayLocale.format(toDate(input));
}

/** "8:42 AM" — numeric hour, 2-digit minute, en-US. Used on editorial surfaces. */
export function formatTimeShort(input: Input): string {
  return _timeShortUS.format(toDate(input));
}

/**
 * "8:42 AM" — numeric hour, 2-digit minute. Uses browser locale (no locale
 * arg) to mirror shift-surface call sites.
 */
export function formatTimeShortLocale(input: Input): string {
  return _timeShortLocale.format(toDate(input));
}

/**
 * "Wed, Apr 29, 8:42 AM" — weekday + month + day + time, browser locale.
 * Shared by ShiftPopover's start label.
 */
export function formatShiftStart(input: Input): string {
  return _shiftStartLocale.format(toDate(input));
}

/** Browser-locale date — uses Intl.DateTimeFormat with default locale and options. */
export function formatLocaleDate(input: Input): string {
  return _localeDateLocale.format(toDate(input));
}

/**
 * Browser-locale date+time — passes through to toLocaleString() with no args.
 * Intl.DateTimeFormat(undefined) with no options renders date-only, not date+time,
 * so we retain toLocaleString() to preserve the original output contract.
 */
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
