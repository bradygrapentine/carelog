/**
 * TD-104 — `pluralize` helper using `Intl.PluralRules` with a thin string fallback.
 *
 * Cheap, no dependencies, locale-aware. Use this instead of `count !== 1 ? 's' : ''`
 * ternaries so we have a single migration target when i18n lands.
 *
 * @example
 *   pluralize(1, "entry", "entries")  // → "1 entry"
 *   pluralize(0, "entry", "entries")  // → "0 entries"
 *   pluralize(2, "entry", "entries")  // → "2 entries"
 *   pluralize(3, "dose")              // → "3 doses"
 */

const cache = new Map<string, Intl.PluralRules>();

function rulesFor(locale: string): Intl.PluralRules {
  let rules = cache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    cache.set(locale, rules);
  }
  return rules;
}

/**
 * Pluralise `singular` or `plural` based on `count`. If `plural` is omitted,
 * the helper appends "s" to `singular` for non-one counts.
 *
 * Returns "<count> <word>" — call sites read naturally without f-string interpolation.
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
  locale: string = "en-US",
): string {
  const word =
    rulesFor(locale).select(count) === "one"
      ? singular
      : (plural ?? `${singular}s`);
  return `${count} ${word}`;
}

/** Just the word — no count. Useful when count is rendered separately. */
export function pluralWord(
  count: number,
  singular: string,
  plural?: string,
  locale: string = "en-US",
): string {
  return rulesFor(locale).select(count) === "one"
    ? singular
    : (plural ?? `${singular}s`);
}
