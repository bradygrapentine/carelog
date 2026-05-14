// ─── AI PHI-slip detection ───────────────────────────────────────────────────
// Scans LLM response text for known PHI values from the de-identification
// nameMap. Returns pure data — callers decide how to log/alert.

export type PhiSlipResult = { slipped: boolean; matchedKeys: string[] };

/**
 * Detect whether the LLM response contains any raw PHI key from nameMap.
 *
 * Keys shorter than 2 characters are skipped to avoid false positives on
 * single-letter substrings. Matching is case-insensitive, word-boundary scoped.
 *
 * IMPORTANT: never pass matchedKeys to external services — only the count.
 */
export function detectPhiSlip(
  response: string,
  nameMap: Map<string, string>,
): PhiSlipResult {
  const matched: string[] = [];
  for (const key of nameMap.keys()) {
    // Skip empty/short keys to avoid runaway false positives on substrings.
    if (key.length < 2) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(response)) matched.push(key);
  }
  return { slipped: matched.length > 0, matchedKeys: matched };
}
