# Wave E — Tier-2 server coverage + audit follow-through

> **⚠ Deprecated merge-policy mention:** This document was written when the repo used Mergify and a `queue` label. As of 2026-05-10, Mergify is no longer in use; the canonical merge flow is `gh pr merge --auto --squash` via GitHub native auto-merge. References to Mergify / `--add-label queue` below are kept as historical record. See `.claude/CLAUDE.md` §Merge Policy.


Continues the Wave B trajectory: closes the remaining Tier-2 backlog rows
(TD-81, TD-82), re-runs the Wave-5 Codex adversarial audit that produced no
output (TD-84), and gates the BriefHero hardcoded mock content (UX-035).

Four file-disjoint tracks, designed to fan out via `/dispatch` ad-hoc.

Base SHA at planning time: `09dd324` (post-Wave-D PR #251). All four parts
branch off current `origin/main` independently.

---

## Pre-flight (run in session before any dispatch)

1. `git fetch origin && git log origin/main --oneline -10` — confirm latest main.
2. Verify Wave B (#247/248/249/250) merged and Wave D (#254..#257) is at least
   in the queue. Wave E does NOT depend on Wave D — both can run in parallel —
   but if any Wave D PR is BLOCKED for unrelated reasons, surface it before
   adding more PRs to the queue.
3. Confirm none of the target stories are already in flight:
   `gh pr list --search "TD-81 OR TD-82 OR TD-84 OR UX-035" --state all`.
4. Print the base SHA each subagent will branch from. All four use the same
   base = current `origin/main`.
5. Worktree layout (under `.worktrees/`, never sibling):
   - `.worktrees/td-81-org-repo-tests` → branch `feat/td-81-org-repo-tests`
   - `.worktrees/td-82-care-events-client-id-pgtap` → branch `feat/td-82-care-events-client-id-pgtap`
   - `.worktrees/td-84-codex-reaudit` → branch `chore/td-84-codex-reaudit`
   - `.worktrees/ux-035-briefhero-gate` → branch `feat/ux-035-briefhero-gate`
6. Symlink `node_modules` per CLAUDE.md (root + apps/web) into each worktree.
7. Docker up if any subagent will run `supabase test db` (TD-82 will).

---

## E1 — TD-81 · `organizationsRepository.test.ts`

**Backlog row (§1):** "Tier 2 — team isolation. Cross-org query (org_id
unfiltered) could be silent in CI if test fixtures don't span orgs."

- **New file (only):** `apps/web/server/repositories/__tests__/organizationsRepository.test.ts`
- Tests: (a) fetch-by-org-id returns only that org's rows, (b) cross-org
  fixture proves `org_id` filter is load-bearing (omitting it returns
  multiple orgs — assert the helper does include it), (c) UUID assignment
  on insert.
- Mirror the mocking pattern from sibling tests under
  `apps/web/server/repositories/__tests__/` (look at `careEventsRepository`
  if it lands first via Wave B's #249, otherwise pick the closest existing).
- **Owner:** Sonnet via Task tool.
- **Estimate:** ~1.5 hr.

## E2 — TD-82 · `care_events_client_id` pgTAP test (or rationale doc)

**Backlog row (§1):** "RLS test stub for `care_events_client_id` migration.
`20260416000001_care_events_client_id.sql` has no dedicated test. Either add
a minimal `supabase/tests/care_events_client_id.test.sql` or document why
it's covered by the existing `care_events_rls.test.sql`."

Discover first, then choose:

1. Read `supabase/migrations/20260416000001_care_events_client_id.sql` and
   `supabase/tests/care_events_rls.test.sql`. Determine whether the existing
   RLS test exercises the `client_id` column path.
2. **If covered** — write a 5-line note in `supabase/tests/care_events_client_id.test.sql`
   that imports nothing, runs no assertions, and contains a comment block
   pointing at the existing test with the line number that exercises
   `client_id`. (pgTAP files that run zero `plan()` are skipped cleanly.)
   This satisfies the backlog row's "document why" branch.
3. **If NOT covered** — write a real pgTAP test asserting the `client_id`
   uniqueness or NOT NULL constraint as the migration intends.

- **Files allowed:** `supabase/tests/care_events_client_id.test.sql` (new only).
- **Owner:** Sonnet via Task tool — judgment call between the two paths.
- **Estimate:** ~1 hr.

## E3 — TD-84 · Re-run Codex adversarial audit

**Backlog row (§1):** "Re-run Codex adversarial audit on apps/web/server +
supabase/migrations + apps/web/inngest. Wave 5 dispatch produced no output
file. Re-dispatch via `/codex:rescue`; route output to `.codex-runs/`."

- This is **orchestration**, not a code change. The PR body is the audit
  output and a follow-up backlog plan derived from findings.
- **Files allowed (only):**
  - `.codex-runs/td-84-reaudit-<ISO>.md` (the audit output, full text)
  - `.codex-runs/td-84-reaudit-<ISO>-summary.json` (the gate's summary record)
- DO NOT bundle any code fix in this PR. Findings become a new TD-* batch
  in a follow-up `chore(backlog)` PR — not here.
- **Owner:** Opus (this session) invokes `/codex:rescue` with the same prompt
  documented in `docs/plans/WAVE5_DISCOVERY_REPORT.md`. Subagent is the
  Codex agent itself (not a Sonnet/Haiku Task).
- **Estimate:** ~30 min orchestration; Codex run wall-clock ~20–60 min.

## E4 — UX-035 · BriefHero mock-content gate

**Backlog row (§6):** "BriefHero hardcoded mock content (and `TODO(UX-24+)`
comment) confirmed present." Now that #244 wired BriefHero to real
`briefs.latestForRecipient`, the mock fallback is dead code that ships to
production users in the no-data state — looks dishonest.

- **File allowed (only):** `apps/web/components/dashboard/BriefHero.tsx`
  + its existing test file `apps/web/components/dashboard/__tests__/BriefHero.test.tsx`
  (extend tests, do not rewrite).
- The "no brief yet" state should render an empty/skeleton placeholder, not
  fabricated medication/journal copy.
- Replace the hardcoded sample with: a one-sentence empty state ("Your first
  brief will arrive after the next journal entry") + the existing eyebrow +
  blob structure. No fake meds/moods/text.
- Add 1 new test asserting that, when `data === undefined && !isLoading`,
  the component renders the empty-state copy and **does not** render the
  fake-content testids (`brief-medications`, etc.).
- **Owner:** Sonnet via Task tool.
- **Estimate:** ~1 hr.

---

## Wave E — Subagent scope contract template

```
FILES ALLOWED: <single file path from above>
BRANCH: <feat/td-81-... | feat/td-82-... | chore/td-84-... | feat/ux-035-...>
DO NOT: edit production code outside the allowed list (TD-81/82 test-only;
        UX-035 is a small component change; TD-84 is doc-only),
        modify BACKLOG.md, touch sibling stories' files
PHI RULE: posthog.identify() / posthog.capture() must use UUID only — never
          email, name, or any PII. Does not directly apply (none of the four
          touch analytics) — kept for policy.
VERIFY:
  - E1 / E4: cd apps/web && npx vitest run <touched test file> --reporter=dot
  - E1 / E4: cd apps/web && npx tsc --noEmit
  - E2: supabase test db (run inside `.worktrees/td-82-...` with Docker up)
  - E3: confirm `.codex-runs/td-84-*` files exist and the gate summary JSON
        is well-formed before opening the PR
HEARTBEAT: append timestamp every ~5 min to .claude/agent-status/<id>.log
```

---

## Wave E — execution mode

- **`/dispatch`** in ad-hoc mode (4 disjoint tasks).
- E1 + E4 use `/tdd-ship` discipline (real code/test changes).
- E2 is small enough to skip TDD (it's effectively a one-file decision).
- E3 is orchestration — no TDD.
- Per PR: local green → `gh pr create` → `gh pr edit <num> --add-label queue` →
  15-min wakeup. Doc-only PRs still go through the queue.

## Wave E — risks

- **E1 may surface a real cross-org leak** in `organizationsRepository`. If
  a failing test reveals a production bug, STOP — escalate. Do not bundle a
  prod fix into the test PR.
- **E2 path-choice ambiguity.** If the existing `care_events_rls.test.sql`
  partially covers `client_id`, document the partial coverage AND add a
  minimal new test for the uncovered branch. Don't punt with a doc-only stub
  if there's a real gap.
- **E3 Codex timeout.** Wave-5's run produced no output. If this re-run also
  produces nothing, capture the failure mode in the summary JSON and STOP —
  do not retry-loop. Re-runs that also fail need human triage (sandbox /
  Codex CLI version drift).
- **E4 test-coverage regression.** Removing the hardcoded mock means any
  existing test asserting on those fake strings will break. Either update
  those assertions OR delete the obsolete test cases — do not duplicate the
  fake content elsewhere just to keep tests passing.

---

## Cross-wave invariants

- **No `BACKLOG.md` edits in feature PRs.** TD-81/82/84 + UX-035 status flips
  via `/backlog-sync` or a dedicated `chore(backlog)` PR after merge.
- **Independent base SHAs.** All four branches off current `origin/main`.
  No cross-track rebases.
- **No file overlap.** E1 owns one repo test file. E2 owns one supabase test
  file. E3 owns `.codex-runs/`. E4 owns BriefHero.tsx + its test. Disjoint.
- **Mergify queue label by default** on every PR; 15-min wakeup per
  CLAUDE.md.

## Suggested running order

- All four parts are file-disjoint. Run via `/dispatch` simultaneously.
- E3 has the longest wall-clock (Codex run) and no merge dependency on the
  others — kick it off first so it overlaps with the others' implementation.
- E2 needs Docker up; if Docker isn't already running, start there before
  dispatch so the worktree's `supabase test db` doesn't block on cold-start.
