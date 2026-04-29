---
name: CareSync
description: Family caregiving coordination — warm, candid, beside-the-user.
colors:
  primary: "#7c3aed"
  primary-light: "#a78bfa"
  primary-subtle: "#ede9fe"
  secondary: "#d97706"
  secondary-light: "#f59e0b"
  secondary-subtle: "#fef3c7"
  tertiary: "#e76f51"
  tertiary-light: "#f08e76"
  tertiary-subtle: "#fbe0d6"
  ink: "#1e0a3c"
  surface: "#faf5ff"
  surface-muted: "#f9fafb"
  app-shell: "#1e0a3c"
  app-shell-text: "#f5f3ff"
  app-shell-muted: "#c4b5fd"
  text-primary: "#1e0a3c"
  text-secondary: "#4b5563"
  muted: "#6b7280"
  border: "#ede9fe"
  warning: "#f59e0b"
  warning-subtle: "#fffbeb"
  success: "#10b981"
  success-subtle: "#f0fdf4"
  danger: "#c41a1a"
  danger-subtle: "#fef2f2"
  mood-good: "#22c55e"
  mood-okay: "#f59e0b"
  mood-difficult: "#f97316"
  mood-crisis: "#ef4444"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.75rem, 3vw + 1rem, 3rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.app-shell-text}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.app-shell-text}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-destructive:
    backgroundColor: "{colors.danger-subtle}"
    textColor: "{colors.danger}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "16px"
  card-header-tinted:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  badge-mood-good:
    backgroundColor: "{colors.success-subtle}"
    textColor: "{colors.mood-good}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-mood-difficult:
    backgroundColor: "{colors.warning-subtle}"
    textColor: "{colors.mood-difficult}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: CareSync

## 1. Overview

**Creative North Star: "The Living Room"**

CareSync is the family room at 11pm, not the hospital corridor at 7am. The system reads as domestic and lived-in: violet plum plays the role of evening lamplight; coral and amber are throw pillows on a sofa, not status pills on a dashboard; Fraunces headlines feel like the cover of a thoughtful magazine on the coffee table. Everything is set on a soft violet-tinted surface, never on stark white.

It is, however, still a tool. The Living Room is calm, but it is not a wellness app and not an EHR. The product has a job to do: log what happened, surface what's next, hand off to the next caregiver. So the system is editorial in feel and unhurried in pacing, but it is not decorative. Every visual choice subtracts cognitive load from someone whose parent is in the hospital. Personality earns its keep or it goes.

It explicitly rejects the four neighbor-failures named in PRODUCT.md: clinical/EHR coldness, sentimental wellness softness, generic-SaaS gradient hero clichés, and maximalist consumer-app loudness. If a screen could be mistaken for any of them, redo it.

**Key Characteristics:**
- Domestic, not corporate. Lamplight violet, never enterprise blue.
- Editorial typography (Fraunces) reserved for hero moments; Geist carries the workhorse load.
- Flat surfaces, lift only on state. No decorative shadows, no glassmorphism.
- Tinted card headers (primary-subtle) carry hierarchy without elevation.
- One thing per screen. The rest hides until needed.

## 2. Colors: The Living Room Palette

A violet-tinted family room at dusk. Lamplight as primary, late-afternoon amber as accent, hearth coral as warmth, plum ink as the voice of the room.

### Primary
- **Lamplight Violet** (`#7c3aed`, oklch ≈ 56% 0.24 296): The dominant identity color. Used for primary buttons, focus rings, links, and active states. Keep it on ≤15% of any given screen — its rarity is the point.
- **Lamplight Violet, Soft** (`#a78bfa`): Hover/pressed state for the primary button. Also appears in dark mode as the elevated primary.
- **Lavender Veil** (`#ede9fe`): Tinted card-header background, also the default border color. Carries hierarchy without contrast load.

### Secondary
- **Late Afternoon Amber** (`#d97706`): Editorial highlight color. Used for in-progress states, the patterns strip on the daily brief, and where amber genuinely means *attention without alarm*. Never used for errors.
- **Soft Custard** (`#fef3c7`): Background tint for warning-adjacent states (in-progress shifts, pending invitations, "needs review" notes).

### Tertiary
- **Hearth Coral** (`#e76f51`): Secondary action accent and iconography highlight. Used sparingly — coral is the throw pillow, not the sofa.
- **Faded Coral** (`#fbe0d6`): Decorative tint for soft accent surfaces.

### Neutral
- **Deep Plum Ink** (`#1e0a3c`): All headings and primary text. Also the app shell color (the side rail and tab bar) — stable across light/dark so the shell never inverts to white-on-white.
- **Morning Violet** (`#faf5ff`): The default page surface. Never `#fff`; every neutral tints toward the brand hue.
- **Stone** (`#f9fafb`): The muted surface for completed/cancelled/off-range items in the timeline.
- **Mist** (`#ede9fe`): Default border color, identical to Lavender Veil. The border never asserts itself; it whispers.
- **Body** (`#4b5563`) / **Muted** (`#6b7280`): Secondary text, eyebrow labels, helper copy.

### Mood Palette (journal-only)
The journal entry borders and badges use a four-step mood spectrum. Pair every mood color with an icon or text label — color alone never carries state.
- **Good** (`#22c55e`) · **Okay** (`#f59e0b`) · **Difficult** (`#f97316`) · **Crisis** (`#ef4444`).

### Named Rules
**The Lamplight Rule.** Lamplight Violet is the brand voice. Use it for the single primary action on a screen, focus rings, and active states. Anything more dilutes it into corporate purple.

**The No-Stark-White Rule.** Never `#fff`. Every neutral tints toward Lamplight Violet. Page surface is `#faf5ff`; cards sit on the same surface and lift via tint, not contrast.

**The Color-Plus-Text Rule.** Mood, severity, and status are never communicated by color alone. Every colored badge or border is paired with an icon or text label. Caregivers under stress and users with color-vision differences read the same UI.

### Dark mode

The system has a complete dark variant (toggle via `.dark` class or `prefers-color-scheme: dark`) — the Living Room at midnight rather than dusk. Lamplight lightens (`#a78bfa`), the page surface drops to a near-black plum (`#0f0a1a`), and the primary-subtle tint inverts to a deep aubergine (`#2e1065`) so tinted card headers still read as recessed rather than washed-out. Ink flips to `#f5f3ff`; the app shell does **not** flip — it stays Deep Plum Ink in both modes, anchoring the chrome.

Marketing routes opt out via `.surface-light-only`, which re-declares the daylight tokens on a descendant — landing pages stay in the daylight palette regardless of system preference. Print mode follows the same opt-out path. Dark-mode `<em>` inside `.headline-display` lightens to `#a78bfa` to clear AA contrast on the dark ink.

## 3. Typography

**Display Font:** Fraunces (variable, opsz 9–144), with Georgia serif fallback.
**Body Font:** Geist (400 / 500 / 600), with system-ui sans fallback.
**Label/Mono Font:** Geist Mono, with ui-monospace fallback.

**Character:** Fraunces is the editorial voice — warm, soft-shouldered, a little literary, used for hero headlines and the Daily Brief only. Geist does the rest of the work: clean, readable, unfussy. Geist Mono appears as the eyebrow label above editorial blocks and as the tone of dates and metadata.

### Hierarchy
- **Display** (Fraunces 400, `clamp(1.75rem, 3vw + 1rem, 3rem)`, line-height 1.1, letter-spacing -0.025em): Editorial headlines on BriefHero, Daily Brief, marketing pages. The `.headline-display` class. Inside it, `<em>` becomes weight-300 italic in Lamplight Violet — the load-bearing emphasis pattern.
- **Headline** (Geist 600, 1.5rem / 24px, line-height 1.25, letter-spacing -0.01em): Page titles in the app, section headers in long content.
- **Title** (Geist 600, 0.875rem / 14px, line-height 1.4): Card titles, panel headers.
- **Body** (Geist 400, 0.875rem / 14px, line-height 1.55): Default body, journal entries, form help text. Cap line length at 65–75ch on long content; on cards and panels, the column constrains it naturally.
- **Label** (Geist Mono 500, 0.6875rem / 11px, letter-spacing 0.04em, uppercase): The `.eyebrow-mono` class. Timestamps, type labels, "TODAY'S BRIEF" eyebrows above editorial headlines. Mono treats data as data.

### Named Rules
**The Editorial Reserve Rule.** Fraunces appears on editorial surfaces only — BriefHero, Daily Brief, marketing pages. Do not refactor existing app UI to Fraunces. Adoption is incremental and deliberate.

**The Italic-Emphasis Rule.** Bare `<em>` keeps default browser styling. Only `.headline-display em` triggers the weight-300 violet italic emphasis. The pattern is scoped on purpose.

**The Mono-Means-Data Rule.** Geist Mono is reserved for eyebrow labels, timestamps, and machine-generated metadata. Do not use mono for body or interactive copy.

## 4. Elevation

CareSync is **flat by default and lifts only on state**. Surfaces sit on the violet-tinted page; depth comes from background tint shifts (Lavender Veil card headers on Morning Violet pages on Stone for muted rows), not from drop shadows. A shadow appears as a *response*: hover, focus, dragging, popover, dialog. It is never decorative.

The app-shell rail and tab bar carry their own dark plum surface (Deep Plum Ink) which is its own elevation plane — separate from the document surface, anchored to the chrome.

### Edge & Shadow Vocabulary
- **ring-1 / ring-foreground/10**: The default rest edge on Cards — a hairline ring of the ink hue at 10% opacity. Reads as a soft inked border, not a drop shadow. Stays present at rest in both light and dark mode.
- **shadow-sm** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): Used on the `<TintedCard>` wrapper to lift it a half-step above the page, paired with the ring.
- **hover lift** (`hover:shadow-md`, `0 4px 6px -1px rgb(0 0 0 / 0.1)`): Card hover. Combined with `motion-safe:hover:-translate-y-0.5` and a 150ms transition. Skipped under `prefers-reduced-motion`.
- **focus ring** (`focus-visible:ring-3 ring-ring/50`, plus the element's own border shifting to ring color): Every interactive element. Replaces shadow as the primary "this is alive" signal.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows respond to state — hover, focus, popover. Decorative drop shadows on landing-page heroes or "feature cards" are forbidden.

**The Tint-Over-Shadow Rule.** When two adjacent surfaces need separation, change the background tint (surface → primary-subtle) before reaching for a shadow. Tinted card headers carry every panel in the app and use no shadow.

## 5. Components

### Buttons
The Base UI primitive (`@base-ui/react/button`), wrapped via `class-variance-authority` in `apps/web/components/ui/button.tsx`.

- **Shape:** Rounded-lg (14px) radius — refined, not pillowy. Active state translates 1px down with a 0.97 scale (motion-safe only) for tactile press feedback.
- **Primary:** Lamplight Violet (`#7c3aed`) background, `primary-foreground` (`#fff` only inside the button — see the HSL bridge note in §4) foreground. Hover on anchor variants dims to 80% opacity. Carries the single primary action per screen.
- **Outline:** Mist (`#ede9fe`) border, Morning Violet background. Hover shifts the surface to the muted token. The default secondary action.
- **Secondary:** Lavender Veil (`#ede9fe`) background, ink foreground. Used where outline is too quiet but primary is too loud.
- **Ghost:** Transparent at rest. Hover shows the muted surface. Lowest-emphasis affordance — toolbars, repeated row actions.
- **Destructive:** `danger/10` background with `danger` (`#c41a1a`) text. Used for irreversible actions; never as the default action color.
- **Sizes:** `xs/sm/default/lg` heights are `24/28/32/36`px. Icon variants are square equivalents; `icon-xs` and `icon-sm` enforce a 40×40px touch target on mobile. Default is 32px.
- **Focus:** `focus-visible:ring-3 ring-ring/50` with the border itself shifting to ring color. Visible on every variant.
- **Transition:** `duration-75` for state changes — snappy enough to feel responsive, never bouncy.

### Inputs / Fields
- **Style:** `border-input` 1px border on transparent background, rounded-lg (14px), 32px height (`h-8`), 4px / 10px padding. Disabled state shifts to `input/50` and drops pointer events.
- **Focus:** Border shifts to ring color, `ring-3` at 50% opacity. No background shift — the ring carries the signal.
- **Invalid:** `aria-invalid` swaps the border to `destructive` and the ring to `destructive/20`. No icon required — the ring is the signal.
- **Label:** Always present and visible (the `<Label>` shadcn primitive sits above the field, never as a placeholder). Geist 500, 14px, ink color.
- **Help text:** 12px Geist 400, muted color, `mt-1` below the field.

### Cards / Containers
The shadcn Card stack, used for every grouped panel in the app.
- **Corner Style:** Rounded-xl (20px). Refined and unhurried.
- **Background:** `bg-card` — the shadcn HSL bridge resolves this to `#fff` in light mode and a deep plum (`hsl(270 80% 10%)`) in dark mode. The bridge predates the No-Stark-White Rule; treat the white card surface as a known legacy artifact and lean on the tinted CardHeader to carry warmth into the panel.
- **Edge Strategy:** `ring-1 ring-foreground/10` at rest carries the edge — a hairline ring of the ink hue at 10% opacity, not a drop shadow. On hover, `shadow-md` appears and the card translates `-0.5` (motion-safe only) for a small lift. Static / non-interactive cards still show the ring but don't lift.
- **Internal Padding:** `py-4` vertical, `px-4` horizontal on sections; the `size="sm"` variant tightens to `py-3 / px-3`. Never inflate beyond 24px — the panel should feel close, not echoey.

#### Tinted Card Header (signature pattern)
The defining panel pattern in the app, encapsulated as `<TintedCard>` + `<TintedCardHeader>` in `apps/web/components/ui/tinted-card.tsx`. The component is the canonical entry point — hand-rolled `<Card className="shadow-sm gap-2">` recipes are legacy and should migrate.

```tsx
<TintedCard>
  <TintedCardHeader title="Section name" action={<button>+ Add</button>} />
  <CardContent className="pt-2">…</CardContent>
</TintedCard>
```

Under the hood: `shadow-sm gap-2` on Card, `-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]` on the CardHeader. The `-mt-4` cancels the Card's default top padding so the tint reaches the edge; `gap-2` tightens the header-body gap from 16 to 8px. The `tone="dark"` variant adds dark-mode bypasses (`dark:bg-gray-700 dark:border-gray-600`) for surfaces that need to read against the dark theme without inverting. This pattern carries hierarchy without elevation — the Tint-Over-Shadow Rule made concrete.

### Chips / Badges
- **Mood badge:** `rounded-sm` (6px), 11px Geist Mono uppercase, paired background-and-text colors from the mood palette. Sits inline next to journal entry text. Never appears alone — always accompanies an entry's text content.
- **Role badge:** Plain Geist 500, 11px, in `app-shell-muted` color when on the dark shell, in `text-secondary` when on a light surface. Distinguishes coordinator / caregiver / supporter / aide without color shouting.

### Navigation
- **App Shell** (left rail on desktop, bottom tab bar on mobile): Deep Plum Ink (`#1e0a3c`) surface, `app-shell-muted` icon labels, `app-shell-text` for the active item. Stable in both light and dark mode — the shell never inverts. Active indicator is a Lamplight Violet pill behind the icon, not a stripe down the side.
- **Header / Toolbar:** Morning Violet surface, `border-b` Mist, ink-color page title in Geist 600 24px. Search and primary action sit at the right.

### Signature Component: BriefHero
The Daily Brief surface is where the Editorial Reserve Rule applies. Fraunces 400 headline (`.headline-display`) sits below a Geist Mono eyebrow ("TODAY'S BRIEF · auto-generated 7:02a"). Inside the headline, `<em>` carries the load-bearing emphasis: "Mom slept *poorly*. Three med doses *missed*." The italic shifts to weight-300 Lamplight Violet. This is the only component where Fraunces carries narrative weight, and the only place where decorative italic emphasis is sanctioned.

## 6. Do's and Don'ts

### Do:
- **Do** keep Lamplight Violet on ≤15% of any screen. Its rarity is the point.
- **Do** tint every neutral toward violet. Page surface is `#faf5ff`; cards sit on `#faf5ff`; muted rows shift to `#f9fafb`. Never `#fff`, never `#000`.
- **Do** pair every mood/severity color with an icon or text label. Color alone is never the signal.
- **Do** use the tinted CardHeader pattern (`-mt-4 px-4 py-3 bg-primary-subtle border-b border-border`) for every grouped panel. It is the signature.
- **Do** reserve Fraunces for editorial surfaces (BriefHero, Daily Brief, marketing). Geist carries the rest.
- **Do** set a single primary action per screen. Everything else is outline, ghost, or hidden until needed.
- **Do** show a visible focus ring (Lamplight Violet 2px, 2px offset) on every interactive element.
- **Do** confirm 40×40px touch targets on mobile, no horizontal scroll at 320px, body line length ≤75ch.

### Don't:
- **Don't** use side-stripe borders (`border-left` greater than 1px as a colored accent on cards or list items). Two narrow exceptions, both already in the codebase: (1) the journal mood border (4px, paired with a text mood badge); (2) react-big-calendar shift-event status pills (3px, paired with status text). New accent stripes outside these surfaces are forbidden.
- **Don't** use gradient text (`background-clip: text` + gradient). Lamplight Violet solid carries every emphasis. Weight or size does the rest.
- **Don't** use glassmorphism / decorative blur. Flat-By-Default Rule — depth is tint, not blur.
- **Don't** ship the hero-metric template (big number, small label, supporting stats, gradient accent). The recipient is a person, not a chart.
- **Don't** ship identical card grids (same-sized cards with icon + heading + text, repeated). Vary card size and content shape with the actual content.
- **Don't** reach for a modal as the first thought. Inline disclosure, panel, drawer, or dedicated route comes first.
- **Don't** look like Epic MyChart, Athenahealth, or any clinical/EHR tool. Color-by-status and dense data tables are the failure mode.
- **Don't** look like a sentimental wellness app. No pastel gradients, no hand-lettered fonts, no butterfly-and-sunset imagery, no "self-care ✨" copy. Worst-fit register.
- **Don't** look like generic SaaS. No Stripe-clone gradients, no "AI-powered" badges, no illustration-heavy landing pages.
- **Don't** look like a maximalist consumer app. No bouncy emoji, no gamified streaks, no confetti. Confetti is never appropriate here.
- **Don't** use em dashes in copy. Commas, colons, semicolons, periods, parentheses.
- **Don't** decorate. Every element earns its keep or it goes.
