/**
 * PDF design tokens — parallel constants for @react-pdf/renderer, which cannot
 * resolve CSS custom properties at render time (it renders to a static buffer
 * before the DOM exists). Values MUST stay in sync with the @theme inline
 * block in apps/web/app/globals.css.
 *
 * When adding or changing a design token in globals.css, update this file too.
 * The pdfTokens.test.ts test asserts the curated subset to catch silent drift.
 *
 * Only tokens actually consumed by PDF route files appear here — do not ship
 * dead constants. If a PDF needs a new color, add the token to globals.css
 * first, then mirror it here.
 *
 * NOTE — drift entries (intentionally kept to preserve pixel-identical PDF
 * output of currently-shipping exports; see TD-93 PR body for migration plan):
 * - `dangerLegacy` (#dc2626) and `inkLegacy` (#1a1a1a) do NOT match any
 *   globals.css token. Their closest semantic mates are `danger` (#c41a1a)
 *   and `ink` (#1e0a3c). Switching to the matched tokens would shift PDF
 *   output, so the legacy values stay until a follow-up UX-level change
 *   approves the visual diff.
 */
export const pdfTokens = {
  // Matched tokens — values mirror globals.css exactly (UX-109: burnt orange)
  ink: "#2A1810", // --color-ink (warm near-black, UX-109 burnt-orange palette)
  muted: "#7A6558", // --color-muted (warm muted, UX-109 burnt-orange palette)
  border: "#E8DFD4", // --color-border (warm border, UX-109 burnt-orange palette)
  danger: "#c41a1a", // --color-danger
  neutral100: "#f3f4f6", // --color-neutral-100
  neutral200: "#e5e7eb", // --color-neutral-200
  neutral400: "#9ca3af", // --color-neutral-400
  neutral700: "#374151", // --color-neutral-700

  // Drift tokens — current shipping PDF values that don't match a globals.css
  // token. Kept verbatim to preserve pixel-identical output.
  dangerLegacy: "#dc2626", // closest match: --color-danger (#c41a1a)
  inkLegacy: "#1a1a1a", // closest match: --color-ink (#1f2820)
} as const;

export type PdfToken = keyof typeof pdfTokens;
