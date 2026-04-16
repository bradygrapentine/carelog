// ─── de-identification utilities ─────────────────────────────────────────────
// Replaces known names with stable tokens before sending data to the Claude API.
// All replacements happen server-side. Free-text fields are never included.

export type NameMap = Map<string, string>;

/**
 * Build a name → token map for a care session.
 * Care recipient → "care recipient"
 * Team members → "team member 1", "team member 2", etc. (deterministic order)
 */
export function buildNameMap(
  recipientName: string,
  teamMemberNames: string[],
): NameMap {
  const map = new Map<string, string>();
  if (recipientName) map.set(recipientName, "care recipient");
  teamMemberNames.forEach((name, i) => {
    if (name) map.set(name, `team member ${i + 1}`);
  });
  return map;
}

/** Replace a single name using the map. Returns original if not found. */
export function deidentifyName(name: string, map: NameMap): string {
  return map.get(name) ?? name;
}

/** Replace all known names in a text string. */
export function deidentifyText(text: string, map: NameMap): string {
  let result = text;
  for (const [original, token] of map) {
    result = result.replaceAll(original, token);
  }
  return result;
}
