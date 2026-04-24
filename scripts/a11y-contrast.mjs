#!/usr/bin/env node
// scripts/a11y-contrast.mjs
// WCAG 2.2 AA contrast ratio validator for Carelog design tokens.
// No npm dependencies — pure Node.js.
// Exit 1 if any pair fails the required threshold.

// --- WCAG relative luminance ---
function linearize(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// --- Token values extracted from apps/web/app/globals.css @theme inline ---
const tokens = {
  white:          '#ffffff',
  ink:            '#1e0a3c',   // --color-ink / --color-text-primary
  'text-primary': '#1e0a3c',   // same as ink
  'text-secondary': '#4b5563', // --color-text-secondary
  muted:          '#6b7280',   // --color-muted
  primary:        '#7c3aed',   // --color-primary (Violet 600)
  danger:         '#c41a1a',   // --color-danger (TD-14: was '#ef4444' — drift from globals.css; the actual token has been #c41a1a since A11Y-005, which already meets WCAG AA at 7.40:1 on white)
  success:        '#10b981',   // --color-success
  warning:        '#f59e0b',   // --color-warning / --color-secondary
  surface:        '#faf5ff',   // --color-surface (page bg)
  'primary-subtle': '#ede9fe', // --color-primary-subtle (tinted header bg)
};

// --- Test pairs ---
// Format: { label, fg, bg, min, note }
// min 4.5 = WCAG AA body text; min 3.0 = large text / UI components / borders
const pairs = [
  {
    label: 'ink on white (body text)',
    fg: tokens.ink,
    bg: tokens.white,
    min: 4.5,
  },
  {
    label: 'text-primary on white (headings)',
    fg: tokens['text-primary'],
    bg: tokens.white,
    min: 4.5,
  },
  {
    label: 'muted on white (helper text / labels)',
    fg: tokens.muted,
    bg: tokens.white,
    min: 4.5,
  },
  {
    label: 'primary on white (text over purple bg — links / chips)',
    fg: tokens.primary,
    bg: tokens.white,
    min: 4.5,
  },
  {
    label: 'danger on white (error text)',
    fg: tokens.danger,
    bg: tokens.white,
    min: 4.5,
  },
  {
    label: 'ink on surface (body text on page bg)',
    fg: tokens.ink,
    bg: tokens.surface,
    min: 4.5,
  },
  {
    label: 'muted on surface (secondary text on page bg)',
    fg: tokens.muted,
    bg: tokens.surface,
    min: 4.5,
  },
  {
    label: 'ink on primary-subtle (tinted panel headers)',
    fg: tokens.ink,
    bg: tokens['primary-subtle'],
    min: 4.5,
  },
  {
    label: 'primary on surface (icon / interactive on page bg — large text / UI)',
    fg: tokens.primary,
    bg: tokens.surface,
    min: 3.0,
  },
];

// --- Run checks ---
let failures = 0;

console.log('Carelog WCAG contrast validator\n');
console.log(
  `${'Pair'.padEnd(55)} ${'Ratio'.padStart(6)}  ${'Min'.padStart(5)}  Result`
);
console.log('-'.repeat(80));

for (const { label, fg, bg, min } of pairs) {
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= min;
  if (!pass) failures++;
  const result = pass ? 'PASS' : 'FAIL';
  console.log(
    `${label.padEnd(55)} ${ratio.toFixed(2).padStart(6)}  ${min.toFixed(1).padStart(5)}  ${result}`
  );
}

console.log('-'.repeat(80));

if (failures === 0) {
  console.log(`\nAll ${pairs.length} pairs passed. ✓`);
} else {
  console.error(`\n${failures} pair(s) FAILED WCAG contrast requirements.`);
  process.exit(1);
}
