// Stagger offset for weekly digest — deterministic per org
export function digestMinuteOffset(orgId: string): number {
  return parseInt(orgId.slice(-4), 16) % 240;
}

// Week stamp for idempotency keys
export function getWeekStamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil(
    ((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7,
  );
  return `${year}-W${week}`;
}

// Day stamp for idempotency keys
export function getDayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// Safe JSON parse with fallback
export function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Format currency
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

// Truncate text
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

// Generate a random hex token (n bytes)
export function randomHexToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
