# CareSync 2.0 — Dashboard prototype

A high-fidelity, click-through design prototype for the **CareSync** family
caregiving coordination app. Companion to the existing repo under
`apps/web` — uses the same burnt-orange "Living Room" palette, type system,
and component vocabulary documented in `DESIGN.md` / `globals.css`.

## What's here

```
caresync_dashboard.html   — main entry. Loads all the JSX modules.
mobile-preview.html       — iPhone-framed mobile preview that loads the
                            dashboard in a 374-px iframe. Open this to
                            see the mobile refactor.

icons.jsx                 — inline lucide-style icon set (Home, Pill, ...).
data.jsx                  — fictional dashboard data (Margaret, meds, brief).
page-data.jsx             — fictional data for every secondary page.

cards.jsx                 — Today-page card components (BriefHero,
                            MedCard, MoodCard, SleepCard, ComingUp,
                            OnShift, PatternCard, NowBoard, MagStat).
today.jsx                 — Today page body — 4 layout variants
                            (editorial / now / magazine / compact).
pages.jsx                 — Journal, Shifts, Medications, Team, Documents,
                            Visit brief, Settings.

dashboard.jsx             — App shell + hash router + Sidebar + MobileNav
                            + MobileTopBar. Mounts <App />.
pages.css                 — All page styles + mobile breakpoint refactor.
                            (Token definitions live inline in
                            caresync_dashboard.html for portability.)
```

## How to run

It's just static files. From this folder:

```sh
python3 -m http.server 8080
# then open http://localhost:8080/caresync_dashboard.html
# or       http://localhost:8080/mobile-preview.html
```

Or open `caresync_dashboard.html` directly in a browser — the in-page
Babel transformer compiles the JSX at runtime, no build step.

## Routing

Hash-based. `#today` (default), `#journal`, `#shifts`, `#meds`, `#team`,
`#documents`, `#brief`, `#settings`. The sidebar nav and the mobile bottom
tab bar both push to `window.location.hash`; `App` listens to `hashchange`.

## Design tokens

The token block at the top of `caresync_dashboard.html` mirrors the burnt-
orange palette from `apps/web/app/globals.css` verbatim. If those move,
update both. Typography: **Fraunces** (display), **Geist** (body), **Geist
Mono** (eyebrows / metadata) — loaded from Google Fonts.

Key principles, preserved from `DESIGN.md`:

- **Lamplight Rule** — primary on ≤15% of any screen (we use primary-pressed
  for the *only* primary button on each page).
- **No-Stark-White Rule** — every surface tints toward the brand hue;
  page background is `#FBF7F2`, never `#fff`.
- **Color-Plus-Text Rule** — every mood/status color pairs with text or
  icon (see `.mood-badge`, `.shift-block`, `.entry`).
- **Tint-Over-Shadow Rule** — tinted card headers (`.ch-tinted`) carry
  hierarchy without elevation. Other header variants available:
  `.ch-outline`, `.ch-accent`, `.ch-serif`.
- **Editorial Reserve** — Fraunces only on BriefHero, Visit brief,
  PatternCard, page titles, and section headings. Geist carries the rest.

## Mobile

`pages.css` has a `@media (max-width: 720px)` block that:

- Hides the desktop sidebar; shows the bottom tab bar (`.mobile-nav`)
  and the slim top bar (`.mobile-top`).
- Stacks page heads; turns action rows into equal-width buttons.
- Stacks all grid layouts to single column.
- Replaces the shifts week-calendar with an agenda list (`.shifts-agenda`).
- Replaces the medications table grid with labeled cards (uses
  `::before` content for the row labels).
- Converts settings sidebar nav into a horizontal pill scroller.
- Stacks `.field-row` so labels sit above inputs.

The **More** sheet (`.mb-sheet`) handles overflow nav items
(Team / Documents / Visit brief / Settings).

## Data shape

All data is mock. The real app feeds these surfaces from tRPC:

- `briefs.latestForRecipient` → BriefHero
- `careEvents.timeline` → NowBoard
- `BriefSection slot="primary|sidebar|footer"` → SleepCard / ComingUp /
  OnShift / PatternCard

When wiring to real data, the components in `cards.jsx` are the right
visual contracts. Their props are mostly cosmetic (header style, density)
— content lives in the `DATA` and `PAGE_DATA` shapes.

## Notes for whoever picks this up

- Care is taken to keep typography hierarchy small (Fraunces titles only
  on hero / page / brief surfaces; Geist body elsewhere).
- The `chips` recipient strip, the journal entry mood border, and the
  shifts agenda all share the **mood-border-left** pattern (kept narrow
  per DESIGN.md's "Don't" — only sanctioned uses).
- `entry-actions` floats absolute on mobile so the entry body has room.
- `setTweak` is still exported from `App` even though there's no panel
  — the layout switcher on the Today page-head uses it to flip the
  Today layout between Editorial / Now / Magazine.
- Babel is loaded at runtime for convenience. For production, precompile
  the JSX modules (esbuild / Vite / Next.js — the existing repo uses
  Next.js so this slots in there cleanly).

— Generated as a design exploration. Mock data only; no PHI.
