# Wave 14 — Tier-1/2 test gaps + visit-recorder triage

**Stories:** TD-113, TD-114, TD-115, TD-116, UX-107
**Estimated effort:** ~9 hr total across 5 PRs (revised from ~7.5 after Opus peer review)
**Source:** `docs/audits/2026-05-10-state-and-gaps.md` §3 + §5
**Base:** `origin/main` post-PR #405 (ROADMAP rewrite)
**Revision:** v2 (2026-05-10) — first draft was rejected by Opus peer review for naming methods that don't exist on the source files. This version's dispatch table is grep-verified against the actual exports.

---

## Strategy

Two parts:

- **Part A — direct, ~1 hr:** UX-107 visit-recorder triage. Investigation, not implementation. Surfaces follow-up rows or a revert decision.
- **Part B — parallel dispatch, 4 PRs, ~6.5 hr wall (~1.5 hr after fan-out):** TD-113..116. File-disjoint test additions, mechanical TDD-style. Same pattern as the shipped TD-78..82 wave.

Why split: UX-107 may surface a `visit_recordings` migration revert or new TD rows; doing it first means Part B isn't dispatched against shifting context. Part B is pure additive test files with zero overlap.

---

## Part A — UX-107 visit-recorder triage (direct, ~1 hr)

**Goal:** decide what to do with `supabase/migrations/20260501132708_visit_recordings.sql`. The state-and-gaps audit found the migration shipped 2026-05-01 but no UI references the table — only the auto-generated `apps/web/lib/database.types.ts` mentions `visit_recordings`. Possibilities (audit §5):
1. Schema-ahead-of-UI per a Phase 7 plan that never landed.
2. Mobile-only feature (Expo route hits the table directly).
3. Aspirational migration that should be reverted.

**Investigation steps (read-only):**

1. `rg "visit_recordings|visitRecordings" apps/ supabase/ packages/ docs/` — full-tree scan. Confirm only `database.types.ts` references it.
2. `git log --all --oneline -- supabase/migrations/20260501132708_visit_recordings.sql` — find the commit that landed it; read the message + PR description.
3. `git log --all --oneline -- apps/mobile/` since 2026-05-01 — confirm no mobile-side wiring.
4. Read `docs/project-info/product/ROADMAP.md` Phase 4 visit-recorder paragraph for stated intent.
5. Check `BACKLOG.md` §7 for any `2026-05-01`-dated row that mentions visit recorder. **If found, the action is "reopen that row," not "open a new ON-NN."**
6. Check `apps/web/inngest/functions/` for any function writing to `visit_recordings` (a recorder pipeline could land rows without a route handler).
7. Check `supabase/seed*.sql` and any fixture files for inserts into the table.

**Decision matrix:**

| Finding | Action |
|---|---|
| Migration is dead schema (no consumer planned soon) | Open a `chore(db): revert visit_recordings migration` PR. Add a follow-up `ON-NN` row capturing the feature for when ready. Keep the rationale visible in §7 shipped log so we don't reintroduce blindly. |
| Mobile/Expo route consumes the table | Document the consumer in ROADMAP Phase 4 visit-recorder paragraph (already says "schema shipped, UI status TBD via UX-107" — refine to "mobile-only at apps/mobile/<path>"). Close UX-107 as informational. |
| Schema is correct but UI was deprioritized | Keep migration. File a fresh `ON-NN` for the UI work. Update ROADMAP Phase 4 visit-recorder line accordingly. Close UX-107 with the link to the new ON row. |

**Out of scope:** building the UI. UX-107 is investigation + decision only.

**Owner:** Opus (judgment call about user-facing schema lifetime).
**Verify:** the chosen action ships in its own scoped PR.
**Branch:** `chore/ux-107-visit-recorder-triage`.

---

## Part B — TD-113..116 parallel dispatch (~6.5 hr → ~1.5 hr wall)

Run only after Part A merges so each test PR branches off clean main.

### Pre-dispatch (required, per `dispatch-preflight` skill)

1. `git fetch origin && git checkout main && git pull --ff-only`.
2. Confirm `git rev-parse origin/main` matches local `main`. Print the SHA all 4 subagents will branch from.
3. Confirm `pnpm test` + `cd apps/web && npx vitest run` green on HEAD.
4. `ls` each `FILES ALLOWED` path before sending the prompts (per `feedback_verify_paths_in_scope_contracts`).
5. Confirm Docker running (Supabase pgTAP needed for one of the suites? — none of TD-113..116 require pgTAP. All vitest.).

### Dispatch table

| Story | Branch | Files (write) | Owner / Model | Notes |
|---|---|---|---|---|
| TD-113 | `test/td-113-care-event-comments` | `apps/web/server/repositories/__tests__/careEventCommentsRepository.test.ts` (new) | sonnet | PHI-adjacent. **Real exports:** `listComments` (RLS-scoped client), `insertComment` (RLS-scoped, accepts `authorId` as a param — does NOT stamp from caller; the router enforces that), `editComment` (RLS-scoped — RLS itself enforces author-only edit), `softDeleteComment` (RLS-scoped), `getFanoutTargets` (`supabaseAdmin`), `getEventOrgId` (`supabaseAdmin`). Mixed RLS/admin client routing per function. **Cover:** (a) `listComments` query shape — filters by `care_event_id`, `is("deleted_at", null)`, `order("created_at", { ascending: true })`, profile join projection `profiles!fk(display_name)`; (b) `insertComment` writes `author_id` from the param (PHI rule check — caller passes UUID, never email); (c) `editComment` updates `body` + `edited_at`, returns the updated row; (d) `softDeleteComment` writes `deleted_at = now()` without hard delete; (e) `getFanoutTargets` uses `supabaseAdmin` and returns membership UUIDs only; (f) `getEventOrgId` uses `supabaseAdmin`, throws if not found. **Pattern:** sibling fixture `apps/web/server/repositories/__tests__/careEventsRepository.test.ts` for the `from().select().eq().*` mock chain. ~1.5 hr |
| TD-114 | `test/td-114-medication-tagging-crud` | `apps/web/server/repositories/__tests__/medicationTaggingRepository.test.ts` (new) | sonnet | `medicationTaggingRepository.ts` uses **`supabaseAdmin`** throughout. **Real exports** (10): `tagCareEvent`, `untagCareEvent`, `listTagsForCareEvent`, `tagDocument`, `untagDocument`, `listTagsForDocument`, `autoTagCareEvent` (try/catch swallows error to 0 + console.warn — silent-failure path), `autoTagDocument` (same pattern), `listEventsForMedication`, `listDocumentsForMedication`. **Cover:** (a) `tagCareEvent` upsert with `ignoreDuplicates: true` — second call no-ops; (b) `confidence: "manual"` and `"auto"` round-trip; (c) `untagCareEvent` deletes by tag id; (d) error from supabase is rethrown with the original message; (e) **`autoTagCareEvent` silent-failure** — when supabase errors, returns `{ tagsCreated: 0 }` and logs warn; this is the regression-prone surface and is NOT covered by `medicationTagging.precision.test.ts`; (f) parallel cases for the document variants. **Note:** matching/precision tests stay in `medicationTagging.precision.test.ts`; this file is CRUD + auto-tagger error paths. ~1.5 hr |
| TD-115 | `test/td-115-shift-trade-state` | `apps/web/server/repositories/__tests__/shiftTradeRequestsRepository.test.ts` (new) | sonnet | **Real exports:** `createRequest`, `respondToRequest` (target user accepts/declines — RLS enforces target-only writes), `acceptRequest` (atomic two-step: status guard then shift reassign — **highest-value untested surface**), `forceOverride`, `listForShift`, `expireStaleRequests`. **Cover:** (a) `createRequest` builds the right insert payload (status="open", target_user_id, expires_at); (b) `respondToRequest` maps `accept|decline|cancel` → `accepted|declined|cancelled` and writes via the RLS client; (c) **`acceptRequest` ordering** — first checks current status === "open", then updates trade row to "accepted", then reassigns the shift; verify mock call ORDER (not just outcome) and that a status-mismatch on the first read short-circuits before any shift mutation; (d) `acceptRequest` partial-failure — if shift reassign step fails after trade row was updated, surface the error (do not auto-rollback the trade row, but the helper must propagate); (e) `forceOverride` admin path bypasses target check; (f) `expireStaleRequests` returns `{ expiredIds }` from the rows whose `expires_at < now()` and status="open". **Layered coverage note:** RLS-level target-user enforcement is covered by pgTAP `shift_trade_requests_rls.test.sql` (TD-20 shipped). Add a header comment in the new file pointing at the pgTAP companion. ~2.5 hr (bumped from 1.5 — `acceptRequest` ordering tests are the bulk). |
| TD-116 | `test/td-116-mood-entries-router` | `apps/web/server/routers/__tests__/moodEntries.test.ts` (new) | sonnet | tRPC router. **Real surface:** ONLY one procedure exported — `sparkline({ recipientId, orgId, days: 1..30 default 13 })`. There is no `create` or `list`. The router is pure-function-heavy: membership gate, day-bucket math, mood→score normalization, latestMood selection. **Cover:** (a) auth boundary — `ctx.user = null` → router rejects (uses `protectedProcedure`); (b) **membership gate** — caller must be accepted member of `orgId`; missing/un-accepted membership → `FORBIDDEN`; (c) day-bucket math — `days: 7` returns 7 buckets ending today (UTC); UTC rollover edge — entries dated just before midnight UTC fall into the right bucket; (d) `MOOD_SCORE` normalization — `crisis=1, difficult=2, okay=3, good=4` round-trips through avg-per-day; (e) `latestMood` — returns the mood from the most recent `occurred_at` row; (f) empty-data `trendSummary` branch — zero entries returns `{ label: null, score: null }` not a crash. Pattern: `user.test.ts` (TD-78) for `createCallerFactory` + `protectedProcedure` mock. ~2 hr (bumped from 1.5 — 6 cases, not 4). |

**Why no TDD spec-author phase:** these are tests against existing code, not spec-then-implement. Implementers write the tests directly against the shipped repositories/routers. If a test fails the first time it runs, that's a real bug in the implementation — escalate to a fix PR rather than modifying the test.

### Subagent scope contract template

```
FILES ALLOWED: <single test file path from the table>
BRANCH: <branch from the table>
DO NOT: add features, modify production source files, touch BACKLOG.md, pass email/PHI to analytics
PHI RULE: posthog.identify() and posthog.capture() must use UUID only — never email, name, or any PII
TASK: write a vitest test file against the existing source. Read the source file (apps/web/server/.../<name>.ts) first. Cover the spec items in the brief.
ITERATION: write tests → run `cd apps/web && npx vitest run <test-path>` → fix → repeat. Hard cap 5 iterations. If a test reveals what looks like a real bug in the source, STOP and write a diagnostic — do not modify the source file. Open the PR with the failing test marked `.skip()` + a `// TODO: TD-NNN — this revealed a bug, see test for details` comment, then file a follow-up TD row.
PRE-GRANTED COMMANDS: `cd apps/web && npx vitest run`, `gh pr create`, `gh pr edit <num> --add-label queue`, `git push -u origin <branch>`
PUSH-EARLY: this is a single-file dispatch but commit after the first green run, push, then add edge cases on the open PR if context allows.
VERIFY: full apps/web vitest suite green after the new file lands. tsc clean. eslint --quiet on the new file.
PR: conventional title `test(td-NNN): <short description>`. Body links the row in BACKLOG.md.
MERGE: apply `queue` label after open. Do NOT use `gh pr merge --auto`.
```

### Post-dispatch verification (per dispatch §5a — mandatory)

For each branch, run:

```sh
gh pr list --author @me --json number,headRefName \
  | jq -r --arg b "<branch>" '.[] | select(.headRefName == $b) | .number' \
  | grep -q . \
  || echo "[ALERT] subagent reported DONE but no PR exists for <branch>"
```

If any alert fires, take the work over directly — do **not** redispatch.

---

## Merge order

1. **Part A and Part B can fan out in parallel.** Reviewer pushed back on the original "Part A first" gating: UX-107's outcome only affects Part B IF the decision is "revert the visit_recordings migration." TD-113..116 don't touch visit_recordings.
2. **Soft gate:** if UX-107 lands on the revert path, hold Part B merges until the revert PR queues — that's a migration change, run it through `migration-safety` skill first.
3. Otherwise queue-label all 4 Part B PRs once each is green; merge order between them is irrelevant (file-disjoint).

After all 5 land: `/backlog-sync` to flip rows to §7. Cite the audit (`docs/audits/2026-05-10-state-and-gaps.md`) so the closed-loop is visible.

---

## Out of scope

- Building visit-recorder UI. UX-107 stops at decide-and-document.
- E2E tests for any of the four repositories — the tests in this wave are unit/integration at the helper layer. E2E for medication tagging exists; shift-trade-requests has its own `e2e/shift-trade-requests.spec.ts`.
- Refactoring any source files. If a test reveals a bug, file it; don't fix in-line.

## Risks

- **TD-115 RLS coupling:** the shift-trade flow leans heavily on RLS for target-user writes. Helper tests can verify the helper builds the right query but cannot assert RLS itself; pgTAP test for `shift_trade_requests_rls` already exists (TD-20 shipped). Note this in the test header so future readers know the layered coverage.
- **TD-115 mock-chain depth:** `acceptRequest` ordering tests need to mock TWO chained admin updates (trade row update + shift reassign). Easy to assert outcome without verifying call ORDER. Use `vi.fn().mockImplementationOnce(...)` chaining and assert against `mock.calls` order.
- **TD-116 router-vs-repo split:** the router does its own DB calls (no repo extraction yet). Tests live at the router layer. Reviewer flagged the brief had room for ~6 cases vs the original 4 — already absorbed into the dispatch table.
- **UX-107 outcome dependency:** if the decision is "revert the visit_recordings migration", that's a data-shape change. Run the revert through `migration-safety` skill before opening the PR.
- **Subagent iteration cap:** when the dispatch brief disagrees with the source, subagents hit the iteration-5 cap and produce zero-test PRs. Mitigated this revision by grep-verifying every method name in the dispatch table against the actual `export async function` lines. Pre-dispatch checklist still includes a `ls` of every owned path.
- **Adversarial review for the test PRs:** Codex backend disabled until 2026-05-16 (global rule). Adversarial review for any of these PRs that surface a real bug must route to a Sonnet subagent, not codex-companion. The `codex-adversarial-gate` skill already has the fallback wired but plans should not assume Codex availability.
