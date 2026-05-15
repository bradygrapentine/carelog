/**
 * Shared mood colour utilities — backed by design tokens from globals.css.
 * All components should import from here rather than hardcoding Tailwind palette classes.
 *
 * NOTE: there are intentionally several alpha tiers across helpers — chip-resting
 * is lighter than chip-selected which is lighter than border tints. Don't unify
 * them without a UX-* row that explicitly green-lights the visual change.
 */

/** The four mood keys used across the journal/symptom UI. */
export type Mood = "good" | "okay" | "difficult" | "crisis";

/**
 * Canonical mood order — single source of truth for picker / segmented-control
 * / digest iteration. `as const satisfies` keeps the tuple narrow without a
 * cast at call sites.
 */
export const MOOD_KEYS = [
  "good",
  "okay",
  "difficult",
  "crisis",
] as const satisfies readonly Mood[];

/**
 * User-facing capitalized labels for the four mood keys. Five UI surfaces
 * share these verbatim; `server/routers/moodEntries.ts` overrides `okay` to
 * "Settled" for weekly-digest tone — see that file for the rationale.
 *
 * Note: `crisis` renders as "Hard" — intentional softer register for the
 * caregiver-facing UI (per the UX-050 "Crisis"→"Hard" rename). The TS key
 * `"crisis"` is kept for stable enum identity in DB rows + analytics.
 */
export const MOOD_LABELS: Record<Mood, string> = {
  good: "Good",
  okay: "Okay",
  difficult: "Difficult",
  crisis: "Hard",
};

/** Convenience accessor; returns the label for a Mood. */
export function moodLabel(mood: Mood): string {
  return MOOD_LABELS[mood];
}

/** Solid dot / indicator colour per mood key */
export const MOOD_DOT_CLS: Record<string, string> = {
  good: "bg-[var(--color-mood-good)]",
  okay: "bg-[var(--color-mood-okay)]",
  difficult: "bg-[var(--color-mood-difficult)]",
  crisis: "bg-[var(--color-mood-crisis)]",
};

/**
 * Tinted badge classes (light background + foreground colour).
 * Uses Tailwind's arbitrary opacity modifier against the token value
 * so the palette stays in sync with globals.css.
 */
export const MOOD_BADGE_CLS: Record<string, string> = {
  good: "bg-[var(--color-mood-good)]/15 text-[var(--color-mood-good)]",
  okay: "bg-[var(--color-mood-okay)]/15 text-[var(--color-mood-okay)]",
  difficult:
    "bg-[var(--color-mood-difficult)]/15 text-[var(--color-mood-difficult)]",
  crisis: "bg-[var(--color-mood-crisis)]/15 text-[var(--color-mood-crisis)]",
};

/**
 * Active (selected) chip border classes — slightly stronger tint.
 */
export const MOOD_CHIP_CLS: Record<string, string> = {
  good: "bg-[var(--color-mood-good)]/20 text-[var(--color-mood-good)] border-[var(--color-mood-good)]/40",
  okay: "bg-[var(--color-mood-okay)]/20 text-[var(--color-mood-okay)] border-[var(--color-mood-okay)]/40",
  difficult:
    "bg-[var(--color-mood-difficult)]/20 text-[var(--color-mood-difficult)] border-[var(--color-mood-difficult)]/40",
  crisis:
    "bg-[var(--color-mood-crisis)]/20 text-[var(--color-mood-crisis)] border-[var(--color-mood-crisis)]/40",
};

// ---------------------------------------------------------------------------
// TD-91 helpers — class lookup functions for call sites that previously
// inlined their own mood→className map. Each helper returns the exact string
// the original inline map produced; alpha/color-mix tiers are intentionally
// preserved verbatim so the visual output is byte-identical to the pre-TD-91
// rendering.
// ---------------------------------------------------------------------------

/** Border-left colour for a journal card edge (no alpha, solid token). */
const MOOD_BORDER_CLS: Record<Mood, string> = {
  good: "border-l-[var(--color-mood-good)]",
  okay: "border-l-[var(--color-mood-okay)]",
  difficult: "border-l-[var(--color-mood-difficult)]",
  crisis: "border-l-[var(--color-mood-crisis)]",
};

/**
 * Outline-style badge using color-mix. Tighter `good` tier (12%/35%) reflects
 * the higher perceived saturation of the green token; the other moods use
 * 15%/40%. These specific percentages are what JournalTimeline shipped with —
 * preserved verbatim under TD-91.
 */
const MOOD_OUTLINE_BADGE_CLS: Record<Mood, string> = {
  good: "bg-[color-mix(in_oklab,var(--color-mood-good)_12%,white)] text-[var(--color-mood-good)] border-[color-mix(in_oklab,var(--color-mood-good)_35%,white)]",
  okay: "bg-[color-mix(in_oklab,var(--color-mood-okay)_15%,white)] text-[var(--color-mood-okay)] border-[color-mix(in_oklab,var(--color-mood-okay)_40%,white)]",
  difficult:
    "bg-[color-mix(in_oklab,var(--color-mood-difficult)_15%,white)] text-[var(--color-mood-difficult)] border-[color-mix(in_oklab,var(--color-mood-difficult)_40%,white)]",
  crisis:
    "bg-[color-mix(in_oklab,var(--color-mood-crisis)_15%,white)] text-[var(--color-mood-crisis)] border-[color-mix(in_oklab,var(--color-mood-crisis)_40%,white)]",
};

/**
 * Selected-chip variant — stronger tint than `MOOD_OUTLINE_BADGE_CLS` to read
 * as "active". `good` uses 18%/45%, the others use 22%/50%. Preserved verbatim
 * from JournalTimeline's filter-chip implementation.
 */
const MOOD_SELECTED_CHIP_CLS: Record<Mood, string> = {
  good: "bg-[color-mix(in_oklab,var(--color-mood-good)_18%,white)] text-[var(--color-mood-good)] border-[color-mix(in_oklab,var(--color-mood-good)_45%,white)]",
  okay: "bg-[color-mix(in_oklab,var(--color-mood-okay)_22%,white)] text-[var(--color-mood-okay)] border-[color-mix(in_oklab,var(--color-mood-okay)_50%,white)]",
  difficult:
    "bg-[color-mix(in_oklab,var(--color-mood-difficult)_22%,white)] text-[var(--color-mood-difficult)] border-[color-mix(in_oklab,var(--color-mood-difficult)_50%,white)]",
  crisis:
    "bg-[color-mix(in_oklab,var(--color-mood-crisis)_22%,white)] text-[var(--color-mood-crisis)] border-[color-mix(in_oklab,var(--color-mood-crisis)_50%,white)]",
};

/** Small bg dot colour (e.g. timeline entry indicator). */
export function moodDotClass(mood: Mood): string {
  return MOOD_DOT_CLS[mood] ?? "";
}

/** Border-left tint for a journal card edge. */
export function moodBorderClass(mood: Mood): string {
  return MOOD_BORDER_CLS[mood] ?? "";
}

/** Outline badge tint (chip-resting / read-only badge). */
export function moodBgClass(mood: Mood): string {
  return MOOD_OUTLINE_BADGE_CLS[mood] ?? "";
}

/**
 * Filter-chip class. With `selected: true`, returns the stronger active tint;
 * otherwise returns the resting outline-badge tint. Both branches preserve
 * the exact `color-mix` percentages from the call site they replace.
 */
export function moodChipClass(
  mood: Mood,
  opts?: { selected?: boolean },
): string {
  if (opts?.selected) return MOOD_SELECTED_CHIP_CLS[mood] ?? "";
  return MOOD_OUTLINE_BADGE_CLS[mood] ?? "";
}
