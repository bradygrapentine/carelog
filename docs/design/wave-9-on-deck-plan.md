# Wave 9 — Shifts data plumbing (on-deck for next session)

This is the next-session plan. Wave 8 (brief surface mount + adapters) is in flight at session-end of 2026-05-01 — PRs #367, #368, #369 queued; the SleepFromEvents + detectPattern subagent (UX-096 + UX-099) is still running and may auto-queue overnight.

## Scope

Three rows from the follow-ups plan:

| ID | Story | Owner | Mode | Schema? |
|---|---|---|---|---|
| UX-100 | `buildShiftWeekGridBlocks()` adapter — `shifts.list` → `ShiftBlock[]` | Sonnet | `/tdd-ship` | no |
| UX-101 | Shift narrative-handoff schema + tRPC + ShiftsPanel wire | **Opus** | `/tdd-ship` | yes |
| UX-102 | Open questions schema + tRPC + ShiftsPanel wire | **Opus** | `/tdd-ship` | yes |

Goal: the Shifts surface in `ShiftsPanel` (the journal route's `shifts` destination) renders **real data** in all four new tabs (Handoff / Week / Team / Questions). Today they all show empty states.

## Recommended sequence

### Step 0 — pre-flight (10 min)
1. Confirm Wave 8 PRs landed: `gh pr list --state open --limit 10` should show zero. If UX-096/099 (subagent) didn't queue overnight, walk into `.worktrees/ux-096-099-helpers`, finish commit + push + PR + queue.
2. Pull latest main: `git fetch origin main && git checkout main && git reset --hard origin/main`. Wave 8 should now be merged; the brief sidebar should render real ComingUp + OnShift derivations once the wire-in PR lands (see "Step 1" below).
3. `git worktree prune` to clean up Wave 8 worktrees.

### Step 1 — Wave 8 wire-in PR (30 min, direct)

Once UX-096/099 helpers + UX-097/098 helpers (#369) are merged, mount the rest of the brief surface:

- Wire `<SleepSparkline>` into DashboardClient's primary column with `sleepFromEvents(careEvents, now)`. Anchor `now` with `useState(() => new Date())`.
- Wire `<PatternCard>` below the dashboard's two-column grid with `detectPattern(careEvents, now)` — render only when non-null.
- Wire `<ShiftQuoteNote>` (needs the prior shift's narrative — depends on UX-101's `shifts.getLatestHandoff` query, so this last piece blocks on Wave 9 step 2). For step 1 ship just SleepSparkline + PatternCard.

Single PR title: `feat(wave-8): wire SleepSparkline + PatternCard into dashboard via UX-096/099 helpers`.

### Step 2 — UX-100 ShiftWeekGrid adapter (45 min, Sonnet subagent)

Pure adapter — model after `buildShiftLanesData` in `apps/web/lib/shiftLayouts.ts`. Input: `shifts.list` results for the current week. Output: `ShiftBlock[]` matching `<ShiftWeekGrid>`'s prop shape (caregiver color rotation can be a simple modulo over a token list).

Then a tiny mount commit on the same PR: in `ShiftsPanel`, replace `blocks={[]}` with `blocks={weekGridBlocks}` derived via `useMemo(() => buildShiftWeekGridBlocks(weekShifts, members), [...])`.

Dispatch as one Sonnet `/tdd-ship` subagent with strict scope:
```
FILES ALLOWED:
  apps/web/lib/shiftLayouts.ts                    (modify — add buildShiftWeekGridBlocks)
  apps/web/lib/__tests__/shiftLayouts.test.ts     (modify — add tests)
  apps/web/app/(app)/journal/[recipientId]/ShiftsPanel.tsx (modify — wire new adapter)
```

### Step 3 — UX-101 shift narrative-handoff schema + tRPC + UI wire (~3–4 hr, Opus direct)

This is the session-anchor: a real schema migration with RLS + pgTAP + tRPC + UI.

1. **Schema dump first**: `/schema-dump` on `shifts` table to anchor the migration shape on what's currently there.
2. **Migration**: `/create-migration shift_handoff_entries` — add a `handoff_entries jsonb DEFAULT '[]'::jsonb NOT NULL` column to `shifts`. (Could be a separate `shift_handoffs` table if a 1:N relationship is wanted; column is simpler for v1.) Decide based on whether multiple handoffs per shift are needed — the prototype shows one-per-shift, so column is fine.
3. **pgTAP**: assert default value, NOT NULL, RLS unchanged.
4. **tRPC**: `shifts.upsertHandoff({ shiftId, entries })` (caregiver who owns the shift can write) + `shifts.getLatestHandoff({ recipientId })` (returns the most recent past shift with non-empty handoff_entries).
5. **UI wire** in `ShiftsPanel`: replace `<NarrativeHandoff mode="view" entries={[]} ... />` with a query+display for view mode, and a mutation+composer for edit mode (toggle when current user is the off-going caregiver).
6. **rls-reviewer agent** on the diff before pushing.

Strict pgTAP rule: tests must NOT call `set local role authenticated` mid-transaction — use the helper from `supabase/tests/_setup.sql` if it exists, otherwise scope the role at `BEGIN`.

### Step 4 — UX-102 open questions schema + tRPC + UI wire (~3 hr, Opus direct)

Same shape as Step 3 but with a new table:

1. **Migration**: `/create-migration shift_questions` — `id uuid pk`, `recipient_id uuid fk`, `org_id uuid fk`, `text text not null`, `raised_by uuid fk auth.users`, `raised_at timestamptz default now()`, `resolved_at timestamptz`, `resolved_by uuid fk auth.users`. RLS: same policy shape as `shifts` (read = members of org, write = caregiver+).
2. **pgTAP**: full coverage including the resolve flow.
3. **tRPC**: `shiftQuestions.list({ recipientId, openOnly? })` + `shiftQuestions.create({ recipientId, text })` + `shiftQuestions.resolve({ id })`.
4. **UI wire** in `ShiftsPanel`: replace `questions={[]}` with the live query + a small "Ask a question" composer above the list.
5. **rls-reviewer agent** before push.

### Step 5 — backlog sync + session end (15 min)
- `/backlog-sync` — promote UX-100, 101, 102 to §7 (and the wire-in PR's UX-095 closing piece if it covers SleepSparkline + PatternCard mounts).
- Update the follow-ups plan doc with what shipped.

## Risk + mitigation

| Risk | Mitigation |
|---|---|
| Schema work in UX-101 turns out to need a separate table (1:N handoffs) | Keep migration small — column first; refactor to table is itself a tracked story if needed |
| tRPC router conventions differ from existing `shifts.list` shape | Read `apps/web/server/trpc/shifts.ts` (or wherever the router lives) FIRST before writing the new procedures |
| ShiftsPanel needs current-user-id to gate edit mode for handoff | Already passed as `currentUserId` prop — verify in step 3 before commit |
| Pre-commit vitest flake on schema-only PRs | Per `Known Gotchas` — re-run manually if `1 failed` appears on a SQL/migration-only diff |

## Out of scope for Wave 9

- Wave 10 (profile data UX-103/104/105) — separate session.
- UX-077 (Today route) and UX-106 (default app shell flip) — both human gates.

## Open at session end (2026-05-01 PM)

- **#367** — chore(backlog): caresync handoff follow-ups plan + 12 new rows
- **#368** — feat(ux-095): mount ComingUpRows + OnShiftSidebar into dashboard
- **#369** — feat(ux-097 + ux-098): comingUpEvents + deriveOnShift helpers
- **(in flight)** UX-096 + UX-099 subagent producing PR for sleepFromEvents + detectPattern helpers

Resume by checking `gh pr list --state open` first.
