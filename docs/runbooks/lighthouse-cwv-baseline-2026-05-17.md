# Lighthouse / CWV baseline — 2026-05-17

Captured during SEO-005 to lock in pre-UX-109 (brand redesign) state. Re-measure after UX-109 lands the image-heavy redesign; regress > 10% on any metric → open a follow-up TD.

## Marketing routes

| Route | LCP (last measured 2026-04-28) | Image surface | Font surface |
|---|---|---|---|
| `/` | 86ms | none (`grep next/image` empty) | Fraunces hero (display: swap) + Geist body |
| `/pricing` | 61ms | none | Geist only |
| `/about` | 63ms | none | Geist only |

All three are well under the 2.5s LCP threshold.

## Audit findings (SEO-005)

1. **Geist `display: "swap"` (fixed)** — `apps/web/app/layout.tsx:7` loaded the primary body font without `display`, defaulting to `auto` → FOIT on slow networks. Sister fonts (Geist Mono, Fraunces) already had `swap`. One-line fix applied this PR.
2. **No `next/image` usage** on marketing routes — "defer below-fold images" item from the SEO-005 backlog row is N/A until UX-109 introduces images.
3. **Critical CSS inlining** — Next.js 16 + Turbopack handles automatically; no manual work needed.
4. **`preconnect` to Google Fonts** — `next/font` already injects appropriate `<link>` tags; nothing to add.
5. **`data-theme="sage"` inline script** — `apps/web/app/layout.tsx:43-46` is ~80 bytes of render-blocking JS. Kept because it prevents FOUC on the sage-only palette (UX-110). Acceptable.

## Re-measure procedure

Run after UX-109 (or any redesign that adds images to marketing pages):

```bash
# Lighthouse against prod
npx lighthouse https://care-log.org/ --only-categories=performance --output=html --output-path=./lh-home.html
npx lighthouse https://care-log.org/pricing --only-categories=performance --output-path=./lh-pricing.html
npx lighthouse https://care-log.org/about --only-categories=performance --output-path=./lh-about.html
```

Targets: perf score ≥ 95, LCP < 2.5s, CLS < 0.1, FID < 100ms.
