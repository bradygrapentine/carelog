# CareSync handoff (frozen design) — implementation plan

Source: `docs/caresync-handoff/` (2026-05-01). The prototype's tweaks panel was
removed; every variant is frozen in `app.jsx`'s `DESIGN` object and the README.
This is the final visual register. Re-implement in our real stack — do **not**
fork the prototype's `index.html` / Babel-in-browser scaffolding.

## Relationship to prior work

`docs/design/caresync-2-0-plan.md` (UX-054..UX-060, all shipped) landed the
**presentational primitives** behind toggles: ThemeSwitcher, card-header
variants, Now Board, MedScheduleStrip, AdherenceChart, BriefingHandoff,
ShiftLanes, TeamNowBoard, PromptedComposer, MoodSpectrum, MoodHeatmap,
RecipientProfile. Several of those are now **alternates**, not defaults — the
frozen handoff picks different variants on Brief, Today, Shifts, and Journal.

Net new work: flip defaults to match the frozen picks; add chrome (rail +
topbar) that didn't exist before; add hero attention card + ℞ glyph + Meds
badges; add the "three new things" sections that were never primitives
(narrative handoff, week-grid, side-by-side likes lists, emergency footer).

## Brand decision (single human gate)

**UX-067 — Flip default theme to Sage; retire `hearth`/`slate` from runtime.**
Status: 🟢 Ready (user-approved 2026-05-01: option (a), Sage default). Every
wave below assumes Sage is the default. ThemeSwitcher (UX-054) keeps light/dark
toggle only.

## Waves

Each wave below is a parallel-dispatch unit: 4–6 disjoint file sets, no shared
state, scope contracts spelled out. Wave 1 is foundation; Waves 2–7 fan out.

### Wave 1 — App-shell chrome (foundation)

The frozen design replaces the current AppShell sidebar with a "sage parlor"
dark rail (`--app-shell: #1f2820`) plus a topbar with command-K search. New
files only — current `AppShellClient.tsx` keeps working until UX-068b mounts
the new rail.

| ID | Task | Files (exclusive) | Owner | Mode |
|---|---|---|---|---|
| UX-068a | **SageRail component** — dark rail w/ brand mark, "Today"/"Record" sections, recipient footer | `apps/web/components/app/SageRail.tsx` (new), `apps/web/app/globals.css` (additive `--app-shell*` tokens block) | Sonnet | `/tdd-ship` |
| UX-068b | **SageTopBar component** — crumb + title + search input + `⌘K` chip + action slot | `apps/web/components/app/SageTopBar.tsx` (new) | Sonnet | `/tdd-ship` |
| UX-068c | **App-shell mount** — wire SageRail + SageTopBar into the `(app)` layout behind a `?shell=sage` opt-in flag | `apps/web/app/(app)/AppShellClient.tsx` (touch only) | **Opus** | direct |

Sequencing: UX-068a + 068b in parallel; 068c rebases last.

### Wave 2 — Daily Brief redesign

Picks: bold display serif headline (italic rejected), 720px single-column,
indented-quote shift note, "Coming up today" rows, on-shift sidebar, pattern
card. Sleep card uses sparkline + plain-language numbers — this is the most
information-dense single change in the wave.

| ID | Task | Files (exclusive) | Owner | Mode |
|---|---|---|---|---|
| UX-070 | **Bold-headline variant** — flip BriefHero default from italic-emphasis to bold display | `apps/web/components/dashboard/BriefHero.tsx`, `apps/web/components/dashboard/__tests__/BriefHero.test.tsx` | Haiku | direct |
| UX-071 | **SleepSparkline** — 7-day inline SVG sparkline + numbers (avg hours, wakes) | `apps/web/components/brief/SleepSparkline.tsx` (new), `apps/web/components/brief/__tests__/SleepSparkline.test.tsx` (new) | Sonnet | `/tdd-ship` |
| UX-072 | **ShiftQuoteNote** — left-rule blockquote with byline, for previous-shift voice | `apps/web/components/brief/ShiftQuoteNote.tsx` (new), test | Haiku | direct |
| UX-073 | **ComingUpRows** — clean rows of next 4–5 events; reads `careEvents.upcoming` | `apps/web/components/brief/ComingUpRows.tsx` (new), test | Sonnet | direct |
| UX-074 | **OnShiftSidebar + PatternCard** — right-rail callouts for who's on/next, mood, one trend | `apps/web/components/brief/OnShiftSidebar.tsx`, `apps/web/components/brief/PatternCard.tsx` (both new), tests | Sonnet | `/tdd-ship` |

Sequencing: all five fully parallel. None touch the same file.

### Wave 3 — Today timeline

Replace the current Today layout default with the time-rail variant. NowBoard
stays as a `?layout=board` alternate (already shipped); time-rail becomes the
canonical view. Filter chips replace whatever toolbar exists now.

| ID | Task | Files (exclusive) | Owner | Mode |
|---|---|---|---|---|
| UX-075 | **TimeRailTimeline** — vertical timestamp rail, chronological event stack, NOW pill, type icons | `apps/web/components/dashboard/TimeRailTimeline.tsx` (new), test | **Opus** | direct (schema-aware: reads `careEvents.timeline`) |
| UX-076 | **TimelineFilterChips** — multi-select chip toolbar (meds / journal / shift / vital / appt) | `apps/web/components/dashboard/TimelineFilterChips.tsx` (new), test | Sonnet | `/tdd-ship` |
| UX-077 | **Today route default** — wire TimeRailTimeline as default, NowBoard behind `?layout=board` | `apps/web/components/dashboard/DashboardViewToggle.tsx` (touch), `apps/web/app/(app)/today/page.tsx` (touch) | Sonnet | direct |

Sequencing: UX-075 + UX-076 in parallel; UX-077 rebases last.

### Wave 4 — Medications polish

UX-057 (day-strip + adherence) already shipped. This wave adds the
attention-hero pattern, the serif ℞ glyph (the only character glyph designated
to survive into production), and the three-state status badges.

| ID | Task | Files (exclusive) | Owner | Mode |
|---|---|---|---|---|
| UX-078 | **MedAttentionHero** — full-width hero card for missed-dose state w/ "record catch-up dose" CTA | `apps/web/components/medications/MedAttentionHero.tsx` (new), test | Sonnet | `/tdd-ship` |
| UX-079 | **RxGlyph** — Fraunces italic ℞ component, used in MedCard + nav | `apps/web/components/medications/RxGlyph.tsx` (new), `apps/web/components/dashboard/MedCard.tsx` (touch icon import only) | Haiku | direct |
| UX-080 | **MedStatusBadge** — pill component: "On track" (sage), "Catch up" (clay), "Missed" (clay-strong) | `apps/web/components/medications/MedStatusBadge.tsx` (new), test | Haiku | direct |
| UX-081 | **Meds route mount** — surface Hero when any med is missed today; replace icons with RxGlyph; wire badges | `apps/web/app/(app)/meds/page.tsx` (touch) | Sonnet | direct |

Sequencing: UX-078–080 fully parallel; UX-081 last.

### Wave 5 — Shifts redesign (default flips)

The shipped `BriefingHandoff` (Sleep–Meds–Schedule) and `TeamNowBoard` are now
**alternates**. The frozen design picks **narrative** handoff and a **plain
list** team. `ShiftLanes` stays available, but the canonical schedule view is
the **week grid**. Adds Sarah's "open questions" card.

| ID | Task | Files (exclusive) | Owner | Mode |
|---|---|---|---|---|
| UX-082 | **NarrativeHandoff** — "Three things you need to know" composer + view (replaces Briefing as default) | `apps/web/components/shifts/NarrativeHandoff.tsx` (new), test | **Opus** | `/tdd-ship` (schema: reads/writes handoff text) |
| UX-083 | **ShiftWeekGrid** — Mon–Sun × hours grid w/ per-person color blocks | `apps/web/components/shifts/ShiftWeekGrid.tsx` (new), test | **Opus** | direct (schema: reads `shifts` table for the week range) |
| UX-084 | **ShiftTeamList** — plain stacked rows (name / role / contact); replaces TeamNowBoard default | `apps/web/components/shifts/ShiftTeamList.tsx` (new), test | Sonnet | direct |
| UX-085 | **OpenQuestionsCard** — inbox-like callout below the handoff for items needing async resolution | `apps/web/components/shifts/OpenQuestionsCard.tsx` (new), test | Sonnet | `/tdd-ship` |
| UX-086 | **Shifts route default flips** — wire Narrative + WeekGrid + TeamList as defaults; legacy variants behind `?layout=…` | `apps/web/app/(app)/shifts/page.tsx` (touch only) | Sonnet | direct |

Sequencing: UX-082–085 parallel; UX-086 last.

### Wave 6 — Journal default flips

The shipped Prompted composer / Mood spectrum / Mood heatmap stay as
alternates. Frozen picks: **inline** composer, **3 badges**, **weekly mood bar
chart**, plus a Friday-export hint card.

| ID | Task | Files (exclusive) | Owner | Mode |
|---|---|---|---|---|
| UX-087 | **Inline composer default** — open textarea + 3 mood badges always visible at top | `apps/web/components/journal/JournalEntryForm.tsx` (touch), test | Sonnet | direct |
| UX-088 | **WeeklyMoodBars** — small bar chart of mood distribution + most-used tags | `apps/web/components/journal/WeeklyMoodBars.tsx` (new), test | Sonnet | `/tdd-ship` |
| UX-089 | **FridayExportHint** — footer card: "Journal compiles into a Friday email to your therapist" | `apps/web/components/journal/FridayExportHint.tsx` (new), test | Haiku | direct |
| UX-090 | **Journal route default flips** — composer mode `'inline'`, sidebar default `'bars'`; alternates behind `?mode=…` | `apps/web/app/(app)/journal/page.tsx` (touch only) | Sonnet | direct |

Sequencing: UX-087–089 parallel; UX-090 last.

### Wave 7 — Profile completion

UX-060 (recipient profile card) shipped the avatar card. Adds the surrounding
pieces: likes/dislikes, care-team list, emergency footer.

| ID | Task | Files (exclusive) | Owner | Mode |
|---|---|---|---|---|
| UX-091 | **LikesDislikesList** — side-by-side bulleted lists | `apps/web/components/app/LikesDislikesList.tsx` (new), test | Haiku | direct |
| UX-092 | **CareTeamList** — stacked rows w/ phone + role; replaces card-grid where used on profile | `apps/web/components/app/CareTeamList.tsx` (new), test | Haiku | direct |
| UX-093 | **EmergencyFooterCard** — DNR status, primary contact, hospital preference; always visible on profile | `apps/web/components/app/EmergencyFooterCard.tsx` (new), test | **Opus** | `/tdd-ship` (PHI: surfaces DNR + emergency contact via `identityRepository` only) |
| UX-094 | **Profile route mount** — compose RecipientProfile + LikesDislikes + CareTeamList + EmergencyFooter | `apps/web/app/(app)/profile/page.tsx` (touch) | Sonnet | direct |

Sequencing: UX-091–093 parallel; UX-094 last.

## Cross-wave rules

1. **Token-only.** No raw hex; consume `--color-primary`, `--app-shell`,
   `--mood-*` from `globals.css`. Wave 1 adds the missing `--app-shell*` block.
2. **Additive first, mount last.** Every wave creates components first, then a
   single route file gets touched at the end to wire them in. Lets fan-out
   subagents avoid stomping on each other.
3. **Scope contracts.** Each dispatched subagent receives the exact `FILES
   ALLOWED` list from the table, the branch name, and the PHI/scope contract
   from `.claude/CLAUDE.md`.
4. **`hearth` / `slate` removal is a separate row.** Don't bundle into other
   waves. After UX-067 lands, open a tiny `chore(theme): drop hearth + slate`
   PR.
5. **Verification per track:** `pnpm typecheck` clean, `cd apps/web && npx
   vitest run` green, related-test hook passes for the touched component.
6. **No backlog edits in feature PRs.** All BACKLOG.md updates land via
   `/backlog-sync` after each wave.

## Sequencing summary

```
UX-067 (brand decision, human gate)
   ↓
Wave 1 (UX-068a/b parallel → 068c)
   ↓
Wave 2 (UX-070..074, 5-wide parallel)   ┐
Wave 3 (UX-075 + 076 parallel → 077)    │  Waves 2–7 are independent
Wave 4 (UX-078..080 parallel → 081)     │  of each other and can run
Wave 5 (UX-082..085 parallel → 086)     │  concurrently after Wave 1.
Wave 6 (UX-087..089 parallel → 090)     │
Wave 7 (UX-091..093 parallel → 094)     ┘
```

Practical pacing: dispatch Wave 1, then in the next session fan Waves 2 + 4 + 7
together (most isolated), then Waves 3 + 5 + 6 (which touch route files and
benefit from sequential merge to avoid trivial conflicts).
