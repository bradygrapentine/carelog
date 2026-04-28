# Carelog — Web UI Standards

These rules apply to every change under `apps/web/app/` and `apps/web/components/`. Load this file before any UI work; violations should be caught in code review.

## Stack (non-negotiable)

- **Tailwind v4** — utility-first. No hand-written CSS modules except the theme block in `app/globals.css`.
- **shadcn/ui** wrapping `@base-ui/react`. Pull new primitives with `npx shadcn@latest add <name>` rather than hand-rolling.
- **Icons**: `lucide-react`. Avoid emoji in production surfaces except where an emoji IS the content (mood tags, reactions).
- **Fonts**: `--font-sans` from `globals.css`. Do not import ad-hoc `@next/font` in components.

## Typography (UX-16)

Three font tokens are exposed via `@theme inline` in `globals.css`, loaded once via `next/font/google` in `app/layout.tsx`:

| Token | Family | Use for |
|---|---|---|
| `var(--font-body)` (alias of `--font-sans`) | Geist 400/500/600 | Default body, UI, controls |
| `var(--font-display)` | Fraunces (variable, opsz 9-144) | Editorial headlines on BriefHero, Daily Brief, marketing |
| `var(--font-mono)` | Geist Mono | Eyebrows, timestamps, data labels |

Three utility classes are exposed in `globals.css` (`@layer components`) for the editorial pattern:

- `.headline-display` — Fraunces 400, `letter-spacing: -0.025em`, tight leading. Use for hero/section headlines on editorial surfaces.
- `.headline-display em` — descendant rule. `<em>` inside a `.headline-display` becomes italic + weight 300 + primary color (the "load-bearing italic emphasis" from the design spec). Outside `.headline-display`, `<em>` keeps default browser italic — no global override.
- `.eyebrow-mono` — 11px uppercase Geist Mono, `letter-spacing: 0.04em`, muted color. Use for "TODAY'S BRIEF · auto-generated 7:02a" style mono labels above headlines.

Rules:

- **Apply selectively to editorial surfaces** (BriefHero, Daily Brief route, marketing pages). Do NOT mass-refactor existing app UI to Fraunces — incremental adoption only.
- Default body text stays on `--font-sans` / `--font-body`. Don't change that without a UX-* row.
- Never style a bare `<em>` globally. The italic-emphasis rule is intentionally scoped to `.headline-display em` so existing literal `<em>` usage across the codebase keeps default browser styling.

## Design tokens — always consume, never invent

Defined in `apps/web/app/globals.css` under `@theme inline`. Reference via CSS variables:

| Purpose | Token | Hex |
|---|---|---|
| Primary | `var(--color-primary)` | `#7c3aed` |
| Primary subtle (tinted headers, chips) | `var(--color-primary-subtle)` | `#ede9fe` |
| Secondary (amber — editorial highlights) | `var(--color-secondary)` | `#d97706` |
| Secondary subtle | `var(--color-secondary-subtle)` | `#fef3c7` |
| Tertiary (coral — secondary actions, iconography) | `var(--color-tertiary)` | `#e76f51` |
| Tertiary subtle | `var(--color-tertiary-subtle)` | `#fbe0d6` |
| Ink / heading | `var(--color-ink)` | `#1e0a3c` |
| Surface | `var(--color-surface)` | `#faf5ff` |
| Body text | `var(--color-text-primary)` / `var(--color-text-secondary)` |
| Muted | `var(--color-muted)` | `#6b7280` |
| Border | `var(--color-border)` | `#ede9fe` |
| Mood badges | `var(--color-mood-{good,okay,difficult,crisis})` |
| Semantic | `var(--color-{warning,success,danger})` |

**Never** write raw hex in a component file. If the color you want isn't in the token list, either pick a close existing token or add a new token to `globals.css` first.

## Accessibility (WCAG 2.2 AA, enforced)

- **Contrast ≥ 4.5:1** for body text, ≥ 3:1 for large (≥18px bold / ≥24px regular) text and interactive borders. Check `ink on surface`, `muted on white`, and any colored button combo before shipping.
- **Keyboard**: every interactive element must be reachable by Tab and activate on Enter/Space. `role="button"` divs are forbidden — use `<button>`.
- **Focus rings**: every interactive element shows a visible focus state. Default pattern: `focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2`. Don't remove focus without providing a replacement.
- **Semantic HTML**: `<button>`, `<nav>`, `<header>`, `<main>`, `<section>`, `<form>`, `<label>`. `<div>` is a last resort.
- **Labels**: every form control has a `<Label>` (visible) or `aria-label` (icon-only controls). Placeholder text is NOT a label.
- **Icon-only buttons**: require `aria-label`.
- **Images**: every `<Image>` / `<img>` has meaningful `alt`. Decorative images use `alt=""` + `aria-hidden="true"`.
- **Radix / @base-ui primitives**: never break their a11y contract (don't add `tabIndex={-1}` to a Trigger, don't strip `role` attributes).

## Responsive

- **Mobile-first**: write default styles for ~375px; layer up with `sm:` `md:` `lg:` `xl:` `2xl:`.
- **Breakpoints** (Tailwind defaults, unchanged): 640 / 768 / 1024 / 1280 / 1536.
- **No horizontal scroll** at 320px. Test with the narrowest column the app supports.
- **Touch targets**: interactive elements ≥ 40×40px on mobile.
- **Container**: page wrappers cap at `max-w-6xl mx-auto px-4` (or `lg:px-8` for dense pages). Avoid full-bleed content without a reason.

## Component hierarchy

- Any grouped content uses shadcn `<Card>` / `<CardHeader>` / `<CardContent>`.
- Panel headers use the light-purple tinted pattern:
  ```tsx
  <Card className="shadow-sm gap-2">
    <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
      <CardTitle className="text-sm">{title}</CardTitle>
    </CardHeader>
    <CardContent className="pt-2">…</CardContent>
  </Card>
  ```
  - `-mt-4` cancels the Card's default top padding so the tint reaches the Card edge.
  - `gap-2` on Card tightens the header↔body gap from 16 → 8 px.
  - Do NOT stack a separate `<Separator />` after a tinted CardHeader — the `border-b` is the divider.
- Forms: `<Label>` above input, `<Input>`/`<Textarea>`/`<select>` next, optional `<p className="text-xs text-muted-foreground mt-1">help text</p>`, then the action row at the bottom.

## Interaction patterns

- **Click-to-open forms** (Add medication, Invite member, Log reading, Start screener, etc.): the trigger is a small "+ Action" text button in the CardHeader or at the bottom of the content. Clicking reveals the form in-panel; clicking Cancel collapses it. Same pattern mobile + desktop.
- **Search / filter toolbars**: rendered above the list they filter, always visible, client-side filtering via `useMemo` or direct filter unless the data exceeds a few hundred rows.
- **Loading**: a single spinner or skeleton per section, not nested.
- **Empty states**: explain why there's nothing + offer a next action. No bare "No data.".
- **Errors**: inline near the failing field in red (`text-[var(--color-danger)]`). Do not throw to top-level error boundaries for recoverable errors.

## Spacing rhythm

- Use Tailwind's default scale (multiples of 4 px). Don't invent arbitrary `p-[13px]`.
- Card internal padding: `p-4` (sections) or `p-5` (headline cards).
- Vertical rhythm between sibling sections: `space-y-4` (dense), `space-y-6` (spacious).
- Icon + text: `gap-2` with `items-center`.

## Before you ship a UI change

- [ ] Typecheck clean for the touched files
- [ ] Vitest green (706+)
- [ ] No raw hex, no raw font-family, no inline CSS color
- [ ] Keyboard-traversable (Tab walks the interactive elements in order)
- [ ] Visible focus ring on every interactive element
- [ ] Works at 320px wide (scroll horizontal test)
- [ ] Works at 1440px wide (no stretched single-line forms across the full width)
- [ ] Labels on every input; `aria-label` on every icon-only button
- [ ] Alt text on every image; `aria-hidden` on decoratives
- [ ] Run key screens through Chrome DevTools > Rendering > Emulate vision deficiencies (Protanopia, Deuteranopia, Achromatopsia) and verify critical information is distinguishable without color alone
