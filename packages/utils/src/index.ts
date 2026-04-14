/** Returns a deterministic minute offset (0–239) derived from the org ID's last 4 hex digits, used to stagger weekly digest sends across orgs. */
export function digestMinuteOffset(orgId: string): number {
  return parseInt(orgId.slice(-4), 16) % 240;
}

/** Returns the current ISO week string (e.g. `"2025-W04"`) used as an idempotency key for weekly jobs. */
export function getWeekStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil(
    ((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7,
  );
  return `${year}-W${week}`;
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
