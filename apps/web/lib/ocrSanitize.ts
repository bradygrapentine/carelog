// SEC-004 — OCR input-sanitization scaffold (FIND-003)
// Pure helpers; no external imports required.

export const MAX_OCR_RAW_TEXT_BYTES = 8 * 1024;

export const DRUG_NAME_PATTERN = /^[A-Za-z0-9 .\-]{1,80}$/;

/**
 * Codepoint-safe byte-budget truncation.
 * Encodes to UTF-8, slices at MAX_OCR_RAW_TEXT_BYTES, then decodes with
 * fatal:false so a partial trailing codepoint is dropped rather than
 * corrupted. Never splits multibyte sequences the way Buffer.slice would.
 */
export function capRawOcrText(raw: string): string {
  const bytes = new TextEncoder().encode(raw);
  if (bytes.length <= MAX_OCR_RAW_TEXT_BYTES) return raw;
  return new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.slice(0, MAX_OCR_RAW_TEXT_BYTES),
  );
}

/**
 * Returns true if `name` (trimmed) matches the allowlist pattern:
 * letters, digits, spaces, dots, hyphens, 1–80 chars.
 */
export function isAllowedDrugName(name: string): boolean {
  return DRUG_NAME_PATTERN.test(name.trim());
}

/**
 * If `fields.drug_name` is present and fails the allowlist, zeroes it out
 * and returns `sanitized: true`. Otherwise returns the original fields
 * object unchanged.
 */
export function sanitizeOcrFields<T extends { drug_name?: string }>(
  fields: T,
): { fields: T; sanitized: boolean } {
  if (fields.drug_name !== undefined && !isAllowedDrugName(fields.drug_name)) {
    return { fields: { ...fields, drug_name: "" }, sanitized: true };
  }
  return { fields, sanitized: false };
}
