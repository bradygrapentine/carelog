/**
 * Shared mood colour utilities — backed by design tokens from globals.css.
 * All components should import from here rather than hardcoding Tailwind palette classes.
 */

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
