/** Returns a deterministic minute offset (0–239) derived from the org ID's last 4 hex digits, used to stagger weekly digest sends across orgs. */
export function digestMinuteOffset(orgId: string): number {
  return parseInt(orgId.slice(-4), 16) % 240;
}

/**
 * Returns the ISO 8601 week stamp for the given date, formatted `YYYY-Www`
 * (e.g. `"2025-W04"`, `"2026-W53"`). Used as an idempotency key for weekly jobs.
 *
 * Implements ISO 8601 §3.4: the Thursday of a given week determines the ISO
 * week-numbering year — so 2024-12-30 (Monday) is in week 1 of 2025, and
 * 2026-12-28 (Monday) is in week 53 of 2026 (a 53-week ISO year).
 *
 * **TZ-deterministic.** Uses `Date.UTC()` and `getUTC*` exclusively, so the
 * result depends only on the absolute instant the `Date` represents — not on
 * the host's local time zone. Two `Date` values referring to the same instant
 * (e.g. `new Date("2026-01-04T23:00:00-08:00")` and `new Date("2026-01-05T07:00:00Z")`)
 * always yield the same stamp.
 */
export function isoWeekStamp(date: Date): string {
  // Per ISO 8601: Thursday of the week determines the year.
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return d.getUTCFullYear() + "-W" + String(weekNum).padStart(2, "0");
}

/** Returns today's date as `YYYY-MM-DD`, used as an idempotency key for daily jobs. */
export function getDayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parses a JSON string, returning `fallback` instead of throwing if the string is invalid. */
export function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Formats an integer amount in the smallest currency unit (e.g. cents) as a localized currency string. */
export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount / 100);
}

/** Truncates `text` to `max` characters, appending `"..."` if it was cut. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

/** Generates a cryptographically random hex string of the given byte length (default 32 bytes = 64 hex chars). */
export function randomHexToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
