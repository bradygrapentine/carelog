# CareSync 2.0 — Implementation Plan

Source: `docs/design/caresync-2-0/` (handoff bundle from claude.ai/design).
Read first: `caresync-2-0/README.md` and `caresync-2-0/chats/chat2.md` (final landing).

## What changed in the design

The design is a **visual register shift**, not a rebuild:

1. **Palette**: violet/plum → "Sage parlor" (eucalyptus `#5a7a5a`, putty `#f6f4ee`, ochre `#a8741a`, clay `#a85040`). Hearth + Slate kept as alternates. New dark mode tokens.
2. **Typography**: Fraunces with `<em>` italic emphasis (weight 300, primary color) for editorial headlines. Geist Mono eyebrows. Body stays Geist.
3. **Card headers**: tinted is the default; new variants `outline`, `accent` (left-bar), `serif` (italic Fraunces title).
4. **Screen redesigns** with picked variants from the prototype:
   - **Daily Brief / BriefHero** — editorial italic headline, 3-block briefing.
   - **Today** — "Now Board" timeline w/ NOW marker, mood-bordered events.
   - **Meds** — schedule + 7-day adherence, day-strip viz, grouped by Time.
   - **Shifts** — Briefing handoff (Sleep–Meds–Schedule) + Lanes schedule + Now-board team.
   - **Journal** — Prompted 3-question composer, mood spectrum, mood-bordered cards, calendar heatmap sidebar.
   - **Marketing** — editorial hero with Fraunces italic.
   - **Profile** — recipient profile card.

## Brand-decision callout (needs user sign-off)

Project CLAUDE.md says the brand is **CareSync** and warns against "fixing" CareSync strings to Carelog. The handoff swaps the **default palette** from violet to sage. That's a brand-visible change.

**Proposed**: ship Sage as a **second selectable theme** alongside the existing violet ("Hearth"). Wire a `data-theme="sage" | "hearth" | "slate"` switcher (the prototype already does this) + dark mode. Leave violet as the live default until a separate decision merges Sage as default. This way none of the screen-level work is blocked on the brand call.

## Gap audit (2026-04-30)

The 2026-04-23 prior handoff already shipped UX-14..UX-21 (BriefHero, Fraunces typography, Patterns strip, Handoff modal, etc). Re-auditing this 2.0 bundle against current code:

| Original track | Status | Action |
|---|---|---|
| T2 typography utilities | DONE — UX-16 shipped `headline-display` + `eyebrow-mono` | drop |
| T4 BriefHero | DONE — UX-17 shipped Fraunces BriefHero | drop |
| T9 marketing hero | DONE — already Fraunces editorial | drop |

Net new tracks (6) below; new IDs **UX-054..UX-060** (UX-053 highest in use).

## Tracks (parallel-safe)

Each track owns disjoint files. File-touch boundaries below are mandatory per `.claude/CLAUDE.md` parallel rules.

| ID | Track | Files (exclusive) | Owner | Mode | Hard? |
|---|---|---|---|---|---|
| UX-054 | **Sage palette + theme switcher** | `apps/web/app/globals.css`, `apps/web/components/theme/ThemeSwitcher.tsx` (new), `apps/web/app/(app)/layout.tsx`, `apps/web/app/(marketing)/layout.tsx` | **Opus (me)** | direct | yes — brand-affecting, must coexist w/ violet |
| UX-055 | **Card header variants** (outline / accent left-bar / serif) | `apps/web/app/globals.css` (additive), `apps/web/components/ui/card.tsx`, `apps/web/components/ui/CardHeaderVariants.tsx` (new) | Sonnet subagent | `/tdd-ship` | no |
| UX-056 | **Today Now Board layout** | `apps/web/components/dashboard/NowBoard.tsx` (new), `apps/web/components/dashboard/DashboardViewToggle.tsx` (extend) | Sonnet subagent | direct | medium |
| UX-057 | **Meds schedule day-strip + 7-day adherence** | `apps/web/components/medications/MedScheduleStrip.tsx` (new), `apps/web/components/medications/AdherenceChart.tsx` (new), `apps/web/components/dashboard/MedCard.tsx` | **Opus (me)** | direct | yes — schema-aware (medication_events) |
| UX-058 | **Shifts: Briefing handoff + Lanes + Now-board team** | `apps/web/components/shifts/BriefingHandoff.tsx` (new), `apps/web/components/shifts/ShiftLanes.tsx` (new), `apps/web/components/shifts/TeamNowBoard.tsx` (new) | **Opus (me)** | direct | yes — schema + multiple layouts |
| UX-059 | **Journal prompted composer + mood spectrum + heatmap** | `apps/web/components/journal/PromptedComposer.tsx` (new), `apps/web/components/journal/MoodSpectrum.tsx` (new), `apps/web/components/journal/MoodHeatmap.tsx` (new) | Sonnet subagent | direct | medium |
| UX-060 | **Recipient profile card** | `apps/web/components/app/RecipientProfile.tsx` (new) | Haiku subagent | direct | no |

UX-054 → UX-055 are foundational. UX-056..UX-060 fan out after both land.

## Coordination rules for the agent team

- **Heartbeat**: every subagent appends a timestamp to `.claude/agent-status/<id>.log` every ~5 min (per `subagent-heartbeat` skill). Orchestrator polls every 10 min; >30 min idle = stalled, kill + redispatch.
- **Cross-track comms**: agents drop short notes to `.claude/agent-status/<id>.notes.md` (one-way to orchestrator). They do NOT edit each other's files.
- **Escalation triggers — escalate to Opus**:
  - Touching a file outside the FILES ALLOWED list.
  - Schema change required (DB / Zod / `database.types.ts`).
  - Conflict with another agent's branch on a shared file.
  - Visual ambiguity not resolvable from the prototype alone.
  - Any analytics call (`posthog.identify` / `posthog.capture`) — PHI rule must be reviewed by Opus.
  - Test failures the agent can't resolve in 5 attempts (`/tdd-ship` escalation).
- **Scope contract** required on every dispatch (boilerplate from `.claude/CLAUDE.md`). PHI rule baked in.

## Sequencing

1. **Phase 0 — foundation (Opus)**: UX-054 (Sage tokens + ThemeSwitcher; violet stays default).
2. **Phase 1 — utilities (1 subagent)**: UX-055 card header variants. Runs in parallel with Phase 2.
3. **Phase 2 — surfaces (parallel fan-out)**: UX-056, UX-059, UX-060 dispatched simultaneously to subagents. Opus runs UX-057 + UX-058 directly in the harness.
4. **Phase 3 — review + integration**: Opus reviews each PR diff (PHI, scope, schema), labels with `queue` after green CI, schedules wakeups.

## Verification

Per track:
- `pnpm typecheck` clean
- `cd apps/web && npx vitest run` green
- a11y: contrast ≥ 4.5:1, focus rings, semantic HTML
- visual: render at 320px, 768px, 1440px; toggle dark mode

## Out of scope (this plan)

- Migrating violet → sage as the default brand. (Filed as `UX-XX` for post-foundation user decision.)
- Mobile (`apps/mobile`) port.
- Touching `BACKLOG.md` from feature PRs (project rule — backlog edits ride in a single `chore(backlog)` PR).
