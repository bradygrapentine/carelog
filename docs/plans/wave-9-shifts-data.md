# Wave 9 — Shifts data plumbing + Wave 8 finalize

Session date: 2026-05-08. Supersedes `docs/design/wave-9-on-deck-plan.md` (written 2026-05-01 PM, now stale — Wave 8 PRs #367–#370 all merged).

## Backlog assessment — candidates considered

Ready queue (27 rows). Candidates surveyed before picking this plan:

| Candidate | Why considered | Why deferred |
|---|---|---|
| **UX-100, UX-101, UX-102** | Pre-staged Wave 9 plan; closes visible empty states in `ShiftsPanel` (Handoff / Week / Questions tabs all render `[]` today). Two of three need migrations + RLS — natural Opus session anchor. | **Selected.** |
| UX-103, UX-104, UX-105 | Profile-page empty states (`<CareTeamList>`, `<LikesDislikesList>`, `<EmergencyFooterCard>` all render with placeholder data). Same shape as Wave 9 (1 no-schema + 2 schema). | Deferred to Wave 10 — different surface, different RLS scope. Sequencing one wave at a time keeps RLS review focused. |
| UX-065, UX-066 | Older CareSync 2.0 enrichment rows; partially overlap with UX-103/104. | Roll into Wave 10 dedup pass. |
| UX-053 | Empty-state primary-action sweep (~2 hr polish). | Small, can be opportunistic — not session-anchor work. |
| TD-78..82, TD-87 | Tier 1/2 server-test sweep (Plan A) — 6 mostly-disjoint test files. | Distinct category (no UI). Better fan-out as a single `/dispatch --from-backlog` once Wave 9 lands. |
| PP-009, A11Y-018, LAUNCH-001, LAUNCH-005, TD-03, TD-83, UX-106, UX-077 | Needs human / decision-gated. | Skip — not eligible. |
| UX-035, UX-041..045, UX-048..051 | Old deferred §6 UI polish. | Parked intentionally; revisit only if a related surface is being touched. |

Pick: **UX-100 + UX-101 + UX-102**, with a Wave-8 finalize wire-in as Step 1 since the Wave-8 adapters all merged but DashboardClient still passes `[]` to `ComingUpRows` and `OnShiftSidebar`, and `SleepSparkline` / `PatternCard` / `ShiftQuoteNote` are commented out at `DashboardClient.tsx:23,384`.

## Scope

| Step | ID | Story | Mode | Schema? | Owner |
|---|---|---|---|---|---|
| 1 | UX-095 closeout | Wire DashboardClient to live adapters (`sleepFromEvents`, `comingUpEvents`, `deriveOnShift`, `detectPattern`); mount `<SleepSparkline>` + `<PatternCard>`; replace `[]` arrays with real derivations | Direct | no | Opus |
| 2 | UX-100 | `buildShiftWeekGridBlocks()` adapter — `shifts.list` → `ShiftBlock[]`; mount in ShiftsPanel "Week" tab | Sonnet `/tdd-ship` | no | Sonnet subagent |
| 3 | UX-101 | Shift narrative-handoff schema + RLS + `shifts.upsertHandoff` / `shifts.getLatestHandoff` tRPC + ShiftsPanel "Handoff" tab wire | Direct (Opus) | yes | Opus |
| 4 | UX-102 | `shift_questions` table + RLS + list/create/resolve tRPC + ShiftsPanel "Questions" tab wire | Direct (Opus) | yes | Opus |
| 5 | — | `/backlog-sync`; promote shipped rows to §7 | Direct | no | Opus |

Goal: Brief surface + Shifts surface both render real data end-to-end. After Wave 9 the only major orphaned UI is the profile page (Wave 10 territory).

## Pre-flight (5 min)

```sh
git fetch origin main && git log --oneline origin/main..HEAD   # expect empty
gh pr list --state open --limit 10                              # expect zero open
git worktree list                                                # prune any Wave 8 leftovers
```

If any Wave 8 worktrees linger: `git worktree remove .worktrees/<name>` (no `--force` — verify clean first).

## Step 1 — Wave 8 finalize (45 min, direct) — REVISED per review C1

One PR titled `feat(ux-095-finalize): wire dashboard brief surface to live adapters`.

**Reality check:** `apps/web/app/(app)/dashboard/page.tsx` is the server component (resolves user/membership only). All careEvents/shifts/mood data is client-fetched inside `DashboardClient.tsx` via `useEffect`. No `DashboardServer.tsx` exists. **Wiring is therefore client-side**, and we MUST honor the React-19 `react-hooks/purity` rule (gotcha in `.claude/CLAUDE.md`).

**Files touched:**
- `apps/web/app/(app)/dashboard/DashboardClient.tsx` — uncomment imports for `SleepSparkline` + `PatternCard`; replace `events={[]}` / `onNow={null}` placeholders with live derivations; introduce a stable `now` anchor.
- (No new files; all four adapters already exist in `apps/web/lib/`.)

**Wiring (client-side, purity-safe):**

```tsx
// Inside DashboardClient.tsx, at the top of the component body:
const [now] = useState(() => new Date());  // lazy init — runs once at mount, stable across renders
// careEvents / shifts / latestMood are already in component state (existing useEffect-driven fetches).

const sleepNights = useMemo(() => sleepFromEvents(careEvents, now), [careEvents, now]);
const comingUp    = useMemo(() => comingUpEvents(careEvents, now), [careEvents, now]);
const onShift     = useMemo(() => deriveOnShift(shifts, latestMood, now), [shifts, latestMood, now]);
const pattern     = useMemo(() => detectPattern(careEvents, now), [careEvents, now]);
```

Render:
- `{sleepNights.length > 0 && <SleepSparkline nights={sleepNights} />}`
- `<ComingUpRows events={comingUp} />` (component owns its empty state)
- `<OnShiftSidebar onNow={onShift.onNow} upNext={onShift.upNext} latestMood={onShift.latestMood} />`
- `{pattern && <PatternCard {...pattern} />}`
- `<ShiftQuoteNote …>` — **defer to Step 3c** (needs `shifts.getLatestHandoff` from UX-101).

**Purity rule check:** zero `Date.now()` / `Math.random()` / `new Date()` calls inside the component render body, `useMemo`, or `useCallback`. `now` is captured once via `useState` lazy init. If lint complains, that's the regression net — fix before push (per gotcha, the failure surfaces in CI Lint, not pre-commit). Run locally:

```sh
cd apps/web && npx eslint --quiet 'app/(app)/dashboard/DashboardClient.tsx'
```

**Verify**: `cd apps/web && npx tsc --noEmit && npx vitest run && npx eslint --quiet 'app/(app)/dashboard/DashboardClient.tsx'` green; load `/dashboard` in `pnpm web` and confirm the brief renders non-empty data for the test recipient (memory: `brady.grapentine@gmail.com`).

**Caveat (per L4):** `now` is captured at mount and never refreshes. If the user keeps the dashboard open for hours, "Coming up" will drift. Acceptable for v1; revisit if observability shows long-lived sessions.

## Step 2 — UX-100 ShiftWeekGrid adapter (45 min, Sonnet `/tdd-ship`)

Pure adapter modeled after `buildShiftLanesData` in `apps/web/lib/shiftLayouts.ts`.

**Scope contract (paste verbatim into the dispatch):**

```
FILES ALLOWED:
  apps/web/lib/shiftLayouts.ts                    (modify — add buildShiftWeekGridBlocks)
  apps/web/lib/__tests__/shiftLayouts.test.ts     (modify — add tests)
  apps/web/app/(app)/journal/[recipientId]/ShiftsPanel.tsx  (modify — wire blocks={…})
BRANCH: feat/ux-100-shift-week-grid
DO NOT: add new tRPC procedures, modify existing buildShiftLanesData, touch any other component
PHI RULE: posthog.identify() and posthog.capture() must use UUID only — never email, name, or any PII
VERIFY: cd apps/web && npx vitest run lib/__tests__/shiftLayouts.test.ts
SUMMARY: list new exports, list tests added, confirm ShiftsPanel "Week" tab now passes real blocks (not [])
```

**Adapter shape (sketch):**

```ts
export function buildShiftWeekGridBlocks(
  shifts: ShiftRow[],
  members: { user_id: string; display_name: string }[],
  weekStart: Date,
): ShiftBlock[] { ... }
```

Caregiver color rotation: simple modulo over a token list (`--color-primary`, `--color-secondary`, `--color-tertiary`, `--color-mood-good`).

Tests cover: empty input → `[]`; multi-day shift splits at midnight; same caregiver across days gets stable color.

## Step 3 — UX-101 shift narrative-handoff (split into 3a/3b/3c per review C2)

Original plan bundled migration + tRPC + ShiftsPanel + cross-surface dashboard mount in a single 3.5 hr PR. Reviewer flagged this as too fat — RLS-reviewer rework + types regen drift typically push such bundles past 5 hr. Split into three serial PRs:

### Step 3a — Migration + pgTAP + types regen (~1.5 hr, Opus direct)

PR title: `feat(ux-101a): shifts.handoff_entries migration + pgTAP + types regen`.

1. **Schema dump first.** Run `/schema-dump shifts` to anchor on current shape.
2. **Decision recorded inline in the migration's leading comment (per review M3):** column-on-shifts (1:1) chosen over separate `shift_handoffs` table because (a) prototype is one-handoff-per-shift, (b) `<NarrativeHandoff>` view mode is overwrite-then-edit (no amendment history surfaced in UI today), (c) reversible — promotion to a table is itself a tracked story if amendments become a product requirement. **If review feedback during this step indicates amendments are imminent, halt and switch to a `shift_handoffs` table.**
3. **`/create-migration shifts_handoff_entries`** — adds:
   ```sql
   ALTER TABLE shifts
     ADD COLUMN handoff_entries jsonb NOT NULL DEFAULT '[]'::jsonb;
   ```
4. **pgTAP** (`supabase/tests/shifts_handoff_entries.test.sql`):
   - Default value is `'[]'::jsonb`
   - NOT NULL constraint enforced
   - RLS policies on `shifts` unchanged (cross-org / cross-recipient leak still blocked)
   - Critical pgTAP rule (per `supabase/CLAUDE.md`): no `SET LOCAL ROLE authenticated` mid-transaction — scope role at `BEGIN`.
5. **Run `rls-reviewer` agent** on the diff before push.
6. **Regen Supabase types in the same PR** (per gotcha): `npx supabase gen types typescript --local 2>/dev/null > apps/web/lib/database.types.ts`.

PR-3a must be merged before PR-3b opens.

### Step 3b — tRPC + ShiftsPanel "Handoff" tab wire (~2 hr, Opus direct)

PR title: `feat(ux-101b): shifts.upsertHandoff/getLatestHandoff + ShiftsPanel wire`.

1. **tRPC** (`apps/web/server/routers/shifts.ts`):
   - `shifts.upsertHandoff({ shiftId, entries })` — only the caregiver who owns the shift OR a coordinator can write. Server-side ownership check, not relying on RLS alone.
   - `shifts.getLatestHandoff({ recipientId })` — most recent past shift with non-empty `handoff_entries`.
2. **UI wire** in `ShiftsPanel.tsx`:
   - Replace `<NarrativeHandoff mode="view" entries={[]} />` with view mode driven by `shifts.getLatestHandoff`.
   - Edit mode gating: verify `currentShift.caregiver_id` is actually plumbed through to `ShiftsPanel`. **Reviewer flagged this — `ShiftsPanel.tsx` exposes `currentUserId` but I have not confirmed the component receives the current shift's caregiver_id.** Pre-flight: `grep -n "currentShift\|caregiver_id" apps/web/app/\(app\)/journal/\[recipientId\]/ShiftsPanel.tsx` before writing the edit-mode branch. If not plumbed, plumb it as part of this PR.
   - Edit mode shows when `currentUserId === currentShift.caregiver_id` AND shift status ∈ `('completed','in_progress')`.
3. PostHog scope contract (per review M2): no `text` content in `posthog.capture()`. Event-only (e.g. `handoff_saved` with shift count, no payload).

### Step 3c — `<ShiftQuoteNote>` mount on dashboard (~30 min, Opus direct)

PR title: `feat(ux-101c): mount ShiftQuoteNote on dashboard brief via shifts.getLatestHandoff`.

Single-file PR touching `DashboardClient.tsx`. Calls `shifts.getLatestHandoff` for the active recipient and renders `<ShiftQuoteNote>` if non-null. This is the Wave-8 deferred piece — clean to ship as its own PR once 3b's tRPC procs are live.

## Step 4 — UX-102 open questions (3 hr, Opus direct)

Same shape as Step 3 with a new table.

1. **`/create-migration shift_questions`**:
   ```sql
   CREATE TABLE shift_questions (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
     recipient_id uuid NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
     text text NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
     raised_by uuid NOT NULL REFERENCES auth.users(id),
     raised_at timestamptz NOT NULL DEFAULT now(),
     resolved_at timestamptz,
     resolved_by uuid REFERENCES auth.users(id),
     CHECK ((resolved_at IS NULL) = (resolved_by IS NULL))
   );
   CREATE INDEX shift_questions_recipient_open_idx
     ON shift_questions(recipient_id, raised_at DESC)
     WHERE resolved_at IS NULL;
   ALTER TABLE shift_questions ENABLE ROW LEVEL SECURITY;
   -- Policies mirror shifts: read = org members; write = caregivers+; resolve = caregivers+.
   ```
2. **pgTAP** — full coverage of read / create / resolve including:
   - Cross-org SELECT returns 0 rows
   - Aide outside the recipient's org can't insert
   - Coordinator can resolve another caregiver's question
   - Resolve sets both `resolved_at` and `resolved_by` atomically
3. **tRPC** (`apps/web/server/routers/shiftQuestions.ts`):
   - `list({ recipientId, openOnly? })`
   - `create({ recipientId, text })`
   - `resolve({ id })` — sets `resolved_at = now()`, `resolved_by = ctx.user.id`

   **PHI handling (per review M2):** `text` may contain a recipient name, symptom description, or other PHI. Scope contract for any subagent or analytics call touching this surface MUST include: "do NOT pass `text` (or any substring) into `posthog.capture()` / `posthog.identify()` — event-name + IDs only." Audit `shiftQuestions` callers for accidental telemetry leakage before push.
4. **UI wire** in `ShiftsPanel`:
   - Replace `questions={[]}` with live query.
   - "Ask a question" composer: small `<Input>` + Submit row above the list.
   - Per-question Resolve button visible to caregivers+.
5. **Run `rls-reviewer` agent**.
6. **Regen Supabase types** again.

## Step 5 — Backlog sync + session end (10 min)

- `/backlog-sync` — flips UX-095 (the closeout piece), UX-100, UX-101, UX-102 to §7.
- Update §0 status board (Ready 27 → 23).
- `/session-end` to summarize.

## Risk + mitigation

| Risk | Mitigation |
|---|---|
| Step 1 wire-in needs server-side `now` to thread through to client without React-19 purity error | Compute `now` in the server component (`DashboardServer.tsx`) and pass derived data as props. `useState(() => new Date())` only if a client-side anchor genuinely needed. |
| 1:1 vs 1:N handoff decision is wrong (need amendments later) | Column approach is reversible — separate `shift_handoffs` table is itself a tracked story; document the call in the migration's leading comment. |
| Pre-commit vitest flake on schema-only PRs (per known gotcha 2026-04-25) | Manual `cd apps/web && npx vitest run` before push; ignore single-failure flake on YAML/markdown-only diffs. |
| `rls-reviewer` flags policy gap → schema migration churn | Run on each schema PR before push; never bundle two migrations in one PR. |
| Supabase types drift causes typecheck cascade | Regen types **inside** the schema PR; do not split types into a follow-up PR. |
| ShiftsPanel current-user-id gating wrong (edit mode visible to non-owners) | `currentUserId` is already prop-passed to `ShiftsPanel`; verify with grep before commit. |
| Concurrent agent on `main` switches branch under us mid-commit | Per CLAUDE.md branch-hygiene rule: re-run `git branch --show-current` immediately before every commit. |

## Out of scope

- Wave 10 — Profile data (UX-103/104/105). Different surface, different session.
- UX-077 (Today route default flip), UX-106 (default app shell flip) — both human gates.
- TD-78..82 server-test sweep — separate `/dispatch --from-backlog` once Wave 9 lands.

## PR ordering

1. **PR-A** (Step 1)  — `feat(ux-095-finalize): wire dashboard brief surface to live adapters` — direct.
2. **PR-B** (Step 2)  — `feat(ux-100): buildShiftWeekGridBlocks adapter` — Sonnet subagent. **Hard gate** (per review L2): must merge before any Step-3/4 PR opens, because both also edit `ShiftsPanel.tsx`.
3. **PR-C1** (Step 3a) — `feat(ux-101a): shifts.handoff_entries migration + pgTAP + types regen` — Opus.
4. **PR-C2** (Step 3b) — `feat(ux-101b): shifts.upsertHandoff/getLatestHandoff + ShiftsPanel wire` — Opus. Depends on PR-C1.
5. **PR-C3** (Step 3c) — `feat(ux-101c): mount ShiftQuoteNote on dashboard` — Opus. Depends on PR-C2.
6. **PR-D1** (Step 4 migration half) — `feat(ux-102a): shift_questions table + RLS + pgTAP + types regen` — Opus.
7. **PR-D2** (Step 4 wire half) — `feat(ux-102b): shiftQuestions tRPC + ShiftsPanel wire` — Opus. Depends on PR-D1.

**Pre-queue green-check protocol** (per review M4 + `.claude/CLAUDE.md`) — run BEFORE every `gh pr edit <num> --add-label queue`:

```sh
PR=<num>
gh pr view "$PR" --json mergeable,mergeStateStatus -q '.mergeable + " / " + .mergeStateStatus'
# Want: MERGEABLE / anything-but-DIRTY. CONFLICTING/DIRTY → rebase first.
gh pr checks "$PR" 2>&1 | grep -E "fail" | head -5
# Want: empty. Any "fail" → fix or rerun before labeling.
```

Then schedule a 10–15 min wakeup on each `--add-label queue` to verify the PR landed. Mergify silent-stalls are the worst failure mode.

## Estimated session shape

Per review L3, original 7.5 hr was optimistic (no allowance for RLS-reviewer rework, types regen drift, or the Step-1 client-side rewrite). Revised:

- Step 0 pre-flight: 5 min
- Step 1 wire-in (client-side, lint-gated): 1 hr
- Step 2 UX-100 dispatch + review: 1 hr (45 min subagent + 15 min orchestrator review)
- Step 3a UX-101 migration + pgTAP + types: 1.5 hr
- Step 3b UX-101 tRPC + UI: 2 hr
- Step 3c UX-101 ShiftQuoteNote mount: 30 min
- Step 4a UX-102 migration + pgTAP + types: 2 hr
- Step 4b UX-102 tRPC + UI: 1.5 hr
- Step 5 close-out: 15 min

Total: **~10 hr** — realistic 2-day split (PR-A + PR-B + PR-C1 day 1; PR-C2 + PR-C3 + PR-D1 + PR-D2 day 2). Single-day execution is possible but leaves zero margin for RLS-reviewer rework.
