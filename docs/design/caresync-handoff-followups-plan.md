# CareSync handoff follow-ups — plan

The 28-story handoff session (PRs #349..#365) shipped every presentational
component from `docs/caresync-handoff/`. Several of those components ended up
**orphaned** (built + tested but never mounted) or **mounted with empty states**
(the route wires the component but no data flows through). This plan closes
those gaps.

## What's still missing — honest audit

| Category | Items |
|---|---|
| Orphaned (component exists, never rendered) | `SleepSparkline`, `ShiftQuoteNote`, `ComingUpRows`, `OnShiftSidebar`, `PatternCard`, `TimeRailTimeline`, `TimelineFilterChips` |
| Mounted, empty-state only | Shifts: `NarrativeHandoff`, `ShiftWeekGrid`, `OpenQuestionsCard`. Profile: `LikesDislikesList`, `CareTeamList`, `EmergencyFooterCard`. |
| Live and working | Sage palette default; bold BriefHero default; Meds (hero + ℞ + badges); Journal sidebar (WeeklyMoodBars + FridayExportHint); App shell behind `?shell=sage` opt-in. |
| Decision-blocked | UX-077 Today route placement; UX-106 default app shell flip. |

## Waves

### Wave 8 — Brief surface mount (no schema)

Mounts the 5 orphaned brief components into `DashboardClient` so users actually
see the editorial brief surface. All work is wiring + adapter helpers; no
migrations.

| ID | Story | Owner | Mode |
|---|---|---|---|
| UX-095 | Mount SleepSparkline + ComingUpRows + ShiftQuoteNote in primary column; OnShiftSidebar in right rail; PatternCard below the fold | Sonnet | direct |
| UX-096 | `lib/sleepFromEvents.ts` — derive 7-night SleepNight[] from care_events | Sonnet | `/tdd-ship` |
| UX-097 | Coming-up events query / adapter (next 4–5 from existing scheduled tables) | Sonnet | `/tdd-ship` |
| UX-098 | On-shift derivation (current/next caregiver from shifts.list + latest mood) | Sonnet | direct |
| UX-099 | Pattern detection helper — pick one trend signal, threshold-driven | Sonnet | `/tdd-ship` |

UX-095 mount can land first with stub data; 096–099 plug real adapters in
afterward. Five tracks, fully parallel-safe, all distinct files.

### Wave 9 — Shifts data (mostly schema)

| ID | Story | Owner | Mode |
|---|---|---|---|
| UX-100 | `buildShiftWeekGridBlocks()` adapter — `shifts.list` → `ShiftBlock[]` | Sonnet | `/tdd-ship` |
| UX-101 | Shift narrative-handoff schema + tRPC + ShiftsPanel wire | **Opus** | `/tdd-ship` |
| UX-102 | Open questions schema + tRPC + ShiftsPanel wire | **Opus** | `/tdd-ship` |

UX-100 is pure adapter — ship first as a quick win. UX-101 + UX-102 are
schema-bearing; each is a session-sized piece (migration + pgTAP + tRPC + RLS +
UI wire).

### Wave 10 — Profile data (mostly schema)

| ID | Story | Owner | Mode |
|---|---|---|---|
| UX-103 | CareTeamList adapter — query memberships + display_names | **Opus** | direct |
| UX-104 | Likes/dislikes schema + edit affordance | **Opus** | `/tdd-ship` |
| UX-105 | Emergency info schema + edit affordance (PHI) | **Opus** | `/tdd-ship` |

UX-103 is a no-schema adapter. UX-104 + UX-105 each carry a migration; UX-105
adds PHI columns and needs the `rls-reviewer` agent gate.

### Wave 11 — Decisions (human gates)

| ID | Story | Owner | Mode |
|---|---|---|---|
| UX-077 | Today route placement | human | decision |
| UX-106 | Default app-shell flip to SageRail | human | decision |

## Sequencing

```
Wave 8 (UX-095..099, 5-wide parallel)              ← starts immediately
   ├─ UX-095 mount (with stub data) lands first
   └─ 096..099 adapters land next, snap into the mount

Wave 9 (UX-100 first, then UX-101 + UX-102)         ← parallel-safe after Wave 8
   └─ UX-100 quick win; 101/102 are schema-heavy

Wave 10 (UX-103 first, then UX-104 + UX-105)        ← parallel-safe with Wave 9
   └─ UX-103 quick win; 104/105 are schema-heavy

Wave 11 (UX-077 + UX-106)                           ← human gates, no Claude work
```

Estimated: Wave 8 fits in one session. Waves 9–10 each need a session per
schema story. Wave 11 unblocks once stakeholders weigh in.

## Execution policy

- Each wave's adapter/no-schema rows can dispatch in parallel as Sonnet
  subagents with `/tdd-ship`.
- Schema rows (UX-101, 102, 104, 105) are Opus-direct: invoke
  `/schema-dump` first, then `/create-migration`, then run `rls-reviewer` on
  the diff before opening the PR.
- Mount rows that touch existing route files (UX-095, UX-101, UX-102, UX-103,
  UX-104, UX-105) merge **last** to avoid rebase pain on the corresponding
  data-helper PRs.
