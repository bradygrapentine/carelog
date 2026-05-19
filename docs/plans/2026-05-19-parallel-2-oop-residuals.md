# Parallel Sprint Plan — /oop residuals (TD-191 + TD-174)

**Date:** 2026-05-19
**Base SHA:** 7355a31514eb0774c2bd48767584afbb89aeeae7
**Tracks:** 2 (track assignment decoupled — any session executes any unclaimed track via `/sprint --session <alias> --track <name> <this-plan-file>`)
**Close:** Any session calls `/parallel-sprint-close <this-plan-file>` after all tracks have written outcome.json sidecars.

## Disjoint-ness verified

- Track A files ∩ Track B files = ∅ ✅
- Track A files ∩ s1's TD-189 files = ∅ ✅
- Track B files ∩ s1's TD-189 files = ∅ ✅
- Shared finalizer-only files: `BACKLOG.md` (§0 status board + row Status flip), `CONTEXT.md` (additive entries only — neither track expected to write any)
- Forbidden-shared check: none found

## Worktrees (pre-created)

- Track A: `worktrees/td-191-oop-residuals/` (branch `fix/td-191-oop-residuals`)
- Track B: `worktrees/td-174-for-update-annotation/` (branch `chore/td-174-for-update-annotation`)

## Coordination with TD-189 (s1, sequential, in flight)

s1 holds `claims.json` entries for `TD-189` + `BACKLOG_MIGRATION` (lock expires 2026-05-20T00:10Z). TD-189 will restructure `BACKLOG.md` into shards. Both tracks below should ship BEFORE TD-189 dispatches its A1 subagent (small + fast); their close-out `Status:` flips happen against the still-monolithic BACKLOG.md, and TD-189's later migration absorbs the post-TD-191/174 state into shards.

**Order of operations:** TD-191 + TD-174 merge first → `/parallel-sprint-close` runs and flips both rows to ✅ Shipped via `/backlog-sync` (s1 has not yet dispatched A1, so no migration-lock conflict) → s1 then dispatches A1 against the now-up-to-date monolithic BACKLOG.md.

**If TD-189's A1 dispatches before this parallel sprint closes:** the BACKLOG_MIGRATION lock is held; `/parallel-sprint-close`'s tail `/backlog-sync` step will fail per the documented lock semantics. The ONLY safe recovery is to wait for the lock's TTL to expire (`expires_at` field on the claim) OR for s1 to call `--close` on TD-189. Do NOT hand-edit BACKLOG.md (corrupts ADR-0002 SoT contract) and do NOT invent a release flag (it doesn't exist; the TD-189 plan proposes one but it ships as part of TD-189 itself).

## N=2 cap breach (REQUIRES USER DECISION BEFORE EXECUTOR DISPATCH)

`~/.claude/docs/multi-session-setup.md` documents a hard cap of N=2 concurrent sessions, rejected at `--session` parse time unless `MAX_SESSIONS` env override is set. s1 currently holds 1 slot (TD-189 sprint, paused at wave-preflight). Launching both Track A and Track B as separate sessions = 3 concurrent = cap breach.

Options the operator must pick before any executor session starts:

1. **Drop one track and use standard /sprint instead.** Recommended for TD-174 (XS, ~15min — wrapper overhead exceeds work content per opus-on-opus cycle 1). Narrows to TD-191 alone; not actually parallel.
2. **Serialize: same session runs Track A, then Track B.** Defeats parallelism but stays within cap.
3. **Set `MAX_SESSIONS=3` for this run** and accept the increased Opus quota burn (~4 subagents per wave × 3 sessions = ~12 concurrent Opus calls at peak; quota event documented in `INDEX.md` `Note` if it fires).
4. **Wait for s1 to ship TD-189 + `--close`** before starting either executor. Adds ~half-day to wall time.

---

## Track A — TD-191 — /oop residuals from TD-188+TD-179 (5 small fixes)

**Worktree:** `worktrees/td-191-oop-residuals/`
**Branch:** `fix/td-191-oop-residuals` off base SHA `7355a31`

**Files allowed:**
- `apps/web/hooks/useEditMode.ts` — wrap `onCancel` callback ref-stability OR document caller-side `useCallback` requirement (TD-191 item 1).
- `apps/web/hooks/__tests__/useEditMode.test.tsx` — tighten React-warning regression filter from `/react|warning/i` to `expect(consoleErrorSpy).not.toHaveBeenCalled()` or known-prefix anchor (TD-191 item 2).
- `apps/web/lib/formatMutationError.ts` — cosmetic `gateInput` allocation cleanup using `PG_DIAG_RE.test(raw) || PG_DIAG_RE.test(causeMsg)` gate (TD-191 item 3).
- `apps/web/lib/__tests__/formatMutationError.test.ts` — corresponding assertions if behavior changes.
- `apps/web/eslint-rules/no-phi-in-analytics.js` — code-comment the TemplateLiteral asymmetry between singular setTag/setExtra path and recursive `isLiteralKey` walker (TD-191 item 4). Documentation-only — no behavioral change unless test added.
- `apps/web/eslint-rules/__tests__/no-phi-in-analytics.test.js` — optional test asserting the documented limit.
- `supabase/tests/update_emergency_info.test.sql` — add explicit pre-state assertion in Case 9 before `lives_ok patch A` / `results_eq patch B` to remove implicit Case-6 dependency (TD-191 item 5).
- (NEVER) `BACKLOG.md`, `CONTEXT.md` (finalizer-only).

**Files out of scope:**
- All of Track B's owned files (copy: `supabase/tests/confirm_ocr_job.test.sql`, `confirm_ocr_job` migration file).
- All of TD-189's territory: `backlog/**`, `docs/adr/0002-*`, `scripts/td-189-*`, `~/.claude/skills/**`.
- All other application code, schemas, configs.

**Acceptance (verifiable post-merge):**
- `cd apps/web && npx vitest run hooks/__tests__/useEditMode.test.tsx lib/__tests__/formatMutationError.test.ts eslint-rules/__tests__/no-phi-in-analytics.test.js` — green.
- **Item 1 verification** (useEditMode ref-stability — internal-ref OR caller-side `useCallback` decision must be observable):
  - Internal-ref branch: `grep -nE "useRef.*onCancel|onCancelRef" apps/web/hooks/useEditMode.ts` returns ≥ 1 line.
  - Caller-side branch: `grep -nE "caller must memoize onCancel|wrap onCancel in useCallback" apps/web/hooks/useEditMode.ts` returns ≥ 1 line in a JSDoc comment.
  - EXACTLY ONE of the two greps must match (the other is wrong).
- **Item 2 verification** (React-warning regression filter tightening): a new test case in `apps/web/hooks/__tests__/useEditMode.test.tsx` calls `consoleErrorSpy` with the literal string `"Cannot update a component (X) while rendering"` (a real-world React 19 warning that doesn't contain "react" or "warning") and asserts the spy IS called. Without the filter tightening this test fails because the old regex `/react|warning/i` would have suppressed it.
- **Item 3 verification** (`formatMutationError` cosmetic): `grep -nE "PG_DIAG_RE\.test\(raw\)\s*\|\|\s*PG_DIAG_RE\.test\(causeMsg\)" apps/web/lib/formatMutationError.ts` returns ≥ 1 hit.
- **Item 4 verification** (ESLint TemplateLiteral asymmetry doc): `grep -nE "TemplateLiteral|template literal" apps/web/eslint-rules/no-phi-in-analytics.js` returns ≥ 1 comment line in the singular setTag/setExtra path explaining the asymmetry with the recursive walker's `isLiteralKey`.
- **Item 5 verification** (pgTAP Case 9): `grep -nE "dnr_status.*absent|pre.state assertion|Case 9 pre" supabase/tests/update_emergency_info.test.sql` returns ≥ 1 hit immediately before Case 9's `lives_ok patch A` line.
- `supabase test db` — all `update_emergency_info` cases still pass.
- `cd apps/web && npx tsc --noEmit` — clean for touched files.
- CI green on the PR.

**Risks + mitigations:**
- Item 1 (useEditMode `cancel` ref-instability) — choosing internal-ref vs caller-`useCallback` is a contract choice; if internal-ref, document loudly in JSDoc; if caller-side, add an ESLint pattern check.
- Item 4 (ESLint TemplateLiteral asymmetry) — documentation-only is the row's recommended path; resist the urge to implement template-key inspection (scope creep into a separate ESLint rule update).
- Item 5 (pgTAP Case 9 dependency) — must not change the test's behavior, only add the explicit assertion line.

---

## Track B — TD-174 — Annotate or test that `FOR UPDATE` is load-bearing in `confirm_ocr_job`

**Worktree:** `worktrees/td-174-for-update-annotation/`
**Branch:** `chore/td-174-for-update-annotation` off base SHA `7355a31`

**Files allowed:**
- `supabase/tests/confirm_ocr_job.test.sql` — add inline comment in Case 5 calling out that `FOR UPDATE` is load-bearing for race-safety; document the coverage gap (no concurrent-waiter test under single-tx serializable). Optional: add a `pg_blocking_pids`/advisory-lock test as Case 6.
- The `confirm_ocr_job` migration file (under `supabase/migrations/`) — locate via `git grep "confirm_ocr_job\b" supabase/migrations/ | head -3` and add an inline SQL comment above the `FOR UPDATE` clause: `-- FOR UPDATE is load-bearing: removes race when two concurrent confirms target the same job. Removing this without an advisory-lock equivalent is a regression.`
- (NEVER) `BACKLOG.md`, `CONTEXT.md` (finalizer-only).

**Files out of scope:**
- All of Track A's owned files (copy: `apps/web/hooks/**`, `apps/web/lib/formatMutationError.ts`, `apps/web/eslint-rules/**`, `supabase/tests/update_emergency_info.test.sql`).
- All of TD-189's territory.
- All other application code, schemas, configs.

**Acceptance (verifiable post-merge):**
- `git grep -nE "FOR UPDATE.*load-bearing|load-bearing.*FOR UPDATE" supabase/` returns at least 1 hit in the `confirm_ocr_job` migration file AND at least 1 hit in `supabase/tests/confirm_ocr_job.test.sql`.
- `supabase test db` — all `confirm_ocr_job` cases still pass (annotation-only change must not alter behavior).
- CI green on the PR.

**Risks + mitigations:**
- XS scope creep — resist adding the advisory-lock integration test unless the comment route is judged insufficient by the implementer. Row body explicitly allows EITHER route; comment route is the recommended baseline.

---

## Close protocol

When both tracks have written `.claude/state/sessions/<alias>/outcome.json`, any session calls:

```
/parallel-sprint-close docs/plans/2026-05-19-parallel-2-oop-residuals.md
```

The close skill absorbs both outcomes, performs the SINGLE `BACKLOG.md` edit (flip TD-191 + TD-174 to ✅ Shipped, append §7 entries) + tail `/backlog-sync` + claims.json + INDEX.md cleanup. Per-track session dirs are deleted last.

**Coordination caveat with TD-189:** if `BACKLOG_MIGRATION` lock is still held by s1 when this close runs, the `/backlog-sync` step will be refused per TD-189 plan §Risks step 5. The ONLY recovery is to wait for the claim's `expires_at` TTL to fire OR for s1 to `--close` TD-189. Do not hand-edit BACKLOG.md (ADR-0002 SoT contract) and do not invent release flags (they don't yet exist).

## Out of scope

- Implementing TD-189 sharded backlog (separate s1 sprint in flight).
- Multi-session driver work (TD-190a-d, blocked-by TD-189).
- All other Ready rows.
