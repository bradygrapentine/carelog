# CareSync 2.0 — Design Handoff

A clickable design prototype for **CareSync 2.0**, a coordination app for families caring for an aging parent. The shell is built with React 18 + Babel-in-browser so it runs by opening `index.html` in any modern browser — no build tooling required.

> **About this hand-off.** This is a **design specification expressed as working code**, not a production codebase. All eight tweakable design variables (palette, accent treatment, schedule visualization, journal entry style, etc.) have been **frozen as constants** in `app.jsx` under the `DESIGN` object. The code is structured to be readable as a spec — please re-implement in your real stack rather than building on this scaffolding.

---

## What's in here

```
index.html          ← entry; loads React + Babel + the .jsx files in order
styles.css          ← the entire design system: tokens, typography, components
app.jsx             ← top-level: state, routing, frozen DESIGN constants
shell.jsx           ← shared chrome: rail (sidebar), topbar, card, avatar, eyebrow
screen-brief.jsx    ← Daily brief (the home screen)
screen-today.jsx    ← Timeline (today's events)
screens-rest.jsx    ← Meds, Shifts, Journal, Profile (all in one file)
README.md           ← you are here
```

---

## Design system

### Voice
**Steady.** Not warm-cloying ("hugs from your CareSync family!") and not clinical ("Patient: Hoffman, M. — vitals nominal"). The audience is exhausted adult children who don't want to be infantilized but also don't want their mom turned into a chart. Copy is observational, specific, and trusts the reader. Examples in `screen-brief.jsx`'s headline strings and `screens-rest.jsx`'s journal placeholders.

### Palette — "Sage parlor"
Eucalyptus + putty + ochre + clay. Quiet, lived-in, residential. Defined as CSS custom properties in `styles.css` and re-applied at mount in `app.jsx` (so they're easy to swap if you want a different brand color).

| Token | Value | Use |
|---|---|---|
| `--primary` | `#5a7a5a` | sage — links, primary actions, brand mark |
| `--secondary` | `#a8741a` | ochre — secondary accents, "schedule" type |
| `--tertiary` | `#a85040` | clay — alerts, "attention" without alarm |
| `--surface` | `#f6f4ee` | page background — paper, not white |
| `--surface-muted` | `#ece9e0` | secondary surface |
| `--app-shell` | `#1f2820` | sidebar/rail dark surface |
| `--ink` / `--text-primary` | `#1f2820` | body text |
| `--text-secondary` | `#4a5448` | meta, captions |
| `--muted` | `#7a8478` | timestamps, hints |
| `--border` | `#dfddd2` | hairlines |

The prototype shipped with five additional palettes (`hearth`, `slate`, `linen`, `dusk`, `oat`) — those have been removed from the handoff. Keep `--primary`/`--secondary`/`--tertiary` as semantic slots so you can re-skin without rewriting components.

### Type
- **Display** — Fraunces (Google Fonts), 9..144 optical-size axis. Used on `.headline-display`, brief headlines, brand mark.
- **Body** — Geist (Google Fonts).
- **Mono** — Geist Mono. Used for times, doses, IDs.

### Shape
- Card radius: **14px** (`--r-lg`); large radius `20px`, small `10px`.
- Hairlines: 1px `--border`.
- Card headers use **soft per-card tints** (`accentMode: 'tinted'`) — e.g. memory-care cards get `--primary-subtle`, alerts get `--tertiary-subtle`. Six other accent treatments were prototyped but not selected.

---

## Page-by-page design decisions

### Daily brief — `screen-brief.jsx`
The home screen. Editorial in feel — closer to a newsletter or morning paper than a dashboard.

- **Width: editorial.** Generous (max ~720px). Single column. Reading rhythm matters more than density.
- **Headline emphasis: bold display serif.** A short, observational sentence like "She watched the cardinals for almost ten minutes this morning" — bold Fraunces, not italic. Italic was tested and felt precious.
- **Sleep pattern: sparkline + numbers.** A 7-day sparkline is the primary signal; numbers (avg hours, # nighttime wake-ups) sit underneath as plain-language support. NOT bars, NOT just numbers — the pattern is the point.
- **Sarah's note: indented quote.** Voice from the previous shift, set as a left-rule quote. Felt human; "card" felt formal; "list" lost the voice.
- **Coming up today: rows.** Clean list of the next 4–5 events with time + label. Not blocks, not a calendar.
- **On-shift sidebar shown.** Right column: who's currently on, who's next, latest journal mood.
- **Pattern card shown.** Below the fold — a small data callout for one notable trend.

### Timeline — `screen-today.jsx`
Today's events as they unfold.

- **Layout: time rail.** Vertical rail on the left with timestamp labels; events stack to the right. Cards layout was tested (each event a card) and felt fragmented; feed layout lost the time anchor.
- **Group: chronological.** Pure time order. "By period" (Morning/Afternoon) and "by type" both broke the felt sense of "what's happening now."
- **Now marker: pill.** A small `NOW` pill on the rail at the current time. Banner was too loud, line was too quiet.
- **Filter style: chips.** Top of page, multi-select. Tabs forced single-select; dropdown hid the filters.
- **Icons on.** Each event type has a small glyph (℞ for meds, etc.) — helps scannability.
- **Color rows by type: off.** The chips already encode type; coloring rows made the page noisy.
- **Quick-log panel + filter panel both shown** in the right column.

### Medications — `screens-rest.jsx` (`ProtoMeds`)
Lots of design surface here because dose state is the most safety-critical content.

- **Attention card: hero.** When a dose is missed, surface it as a full-width hero card at the top with a "record catch-up dose" CTA. Banner was too thin for the gravity; inline got buried.
- **List layout: rows.** One row per medication. Cards looked like an e-commerce grid; table was correct but cold.
- **Group by: none (flat list).** Tested grouping by condition and by time-of-day; both fragmented adherence into too many small lists. A flat list was easier to scan against the day-strip.
- **Schedule viz: day strip.** Each med has a 24h horizontal strip with a dot per scheduled dose, color-coded by status (taken / upcoming / missed). The single most important visualization in the app — it answers "is mom on track today?" at a glance.
- **Med icon: serif ℞.** Italic Fraunces ℞ glyph — distinctive, calm, on-brand. Pill icon and initial-letter both tested; the ℞ won on character.
- **Status indicator: badge.** Small pill: "On track" (sage), "Catch up" (clay), "Missed" (clay-strong). Dots+label were ambiguous; adherence bars belonged on the weekly card, not per-med.
- **"Today's schedule" strip shown.** A combined 24h timeline with all meds plotted, NOW marker.
- **"7-day adherence" card shown.** Small summary card at the bottom.

### Shifts — `screens-rest.jsx` (`ProtoShifts`)
Coordinating between caregivers.

- **Handoff treatment: narrative.** "Three things you need to know" — short paragraphs from the off-going caregiver. Checklist felt task-y (this isn't a job); briefing (Sleep / Meds / Schedule blocks) was too clinical.
- **Schedule view: week grid.** Mon–Sun across, hours down, blocks colored per-person. Lanes (per-person swim-lanes) and "Next 5" both shipped as alternates but the grid is the canonical one.
- **Care team layout: list.** Plain stacked rows with name, role, contact. Roster (avatar grid) felt like a yearbook; now-board (grouped by On now / Up next / Later / Off) was clever but high cognitive load.
- **Sarah's open questions card shown.** Inbox-like callout below the handoff for items needing async resolution.

### Journal — `screens-rest.jsx` (`ProtoJournal`)
Private notes, mostly used for venting and remembering.

- **Composer: inline.** Open textarea + mood badges + post button, always visible at the top. Prompted (3 questions) felt schoolwork-y; minimal hid the mood selector.
- **Mood control: badges.** Three moods: good / steady / difficult. Spectrum (segmented slider) felt too quantified; tags were too open-ended.
- **Entry style: card-bordered.** Each entry as a soft card with hairline border, mood dot, byline, timestamp. "Page" (typewriter w/ left rule) was striking but precious; "thread" (chat-style) implied the entries were messages to someone.
- **Sidebar: weekly mood bars + tags.** Small bar chart showing mood distribution this week, plus most-used tags. Calendar heatmap was nice but oversold the data; tags-only was thin.
- **"Friday export to therapist" hint shown** — small footer card explaining the journal can compile into a Friday email.

### Profile — `screens-rest.jsx` (`ProtoProfile`)
Mom's profile — "the living room."

- **Portrait: avatar card.** Photo + name + age + relationship + condition tags, in a single composed card. Editorial (full-bleed gradient hero) felt celebrity-magazine; minimal lost the warmth.
- **Likes & dislikes: list.** Plain bulleted lists side-by-side. Cards added unnecessary chrome; narrative paragraph was lovely on the page but bad for scanning at 2am.
- **Care team: list.** Stacked rows w/ phone + role. Cards turned the team into trading cards; directory (table) was correct but cold.
- **Emergency card shown.** Small footer card with DNR status, primary contact, hospital preference. Always visible — never hidden in a submenu.

---

## Architecture notes for re-implementation

This prototype is a single-page React app loaded as Babel-in-browser, which is **deliberately not how you should ship this**. Notes for the real build:

1. **Component boundaries are right; file boundaries aren't.** `shell.jsx` (Rail, TopBar, Card, Avatar, Eyebrow) maps to your component library. `screen-*.jsx` files each map to a route. `screens-rest.jsx` exists only because of Babel-in-browser scope quirks — it should be split into 4 route components.

2. **State.** The prototype uses one `useReducer`-shaped `useAppState` hook. In production this is your server state for journal entries, dose-taken events, handoff status; the reducer's actions (`addJournal`, `takeDonepezil`, `acceptHandoff`) map directly to your mutations.

3. **Tokens.** `styles.css` is structured as `:root` custom properties. Lift these into your design-tokens layer (Tailwind config / Stitches theme / vanilla-extract / etc.). The semantic names (`--primary`, `--surface`, `--text-primary`) should survive into production.

4. **Demo content.** All text in the screens is placeholder "Margaret Hoffman" content for one specific care scenario (82yo mom, early-stage Alzheimer's, three caregivers: Sarah day-shift / Anna evenings / James weekend overnight). Replace with real data plumbing.

5. **Iconography.** Inline glyphs (◐, ▤, ℞, ◑, ✎, ◉, ▦, ✚) are character-based placeholders — replace with your icon library. The serif ℞ is the only character-based glyph that should survive into production (it's a brand decision, not a placeholder).

6. **Interactions wired in the prototype:**
   - Sidebar nav between 6 screens
   - Brief: dismiss attention items
   - Meds: record catch-up dose for donepezil
   - Shifts: accept handoff
   - Journal: write & post entry, select mood
   - Toast on every state change

7. **What's NOT wired:** filters on Timeline, the search box, the calendar/document/visit-summary screens. Stubbed but not interactive.

---

## Running it

```
cd caresync-handoff
# Either open index.html directly, or:
python3 -m http.server 8000
# → http://localhost:8000
```

Requires internet (for unpkg-hosted React/Babel and Google Fonts).
