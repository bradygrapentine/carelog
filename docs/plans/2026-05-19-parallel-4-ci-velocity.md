# Parallel Sprint Plan — CI velocity (4 tracks)

**Date:** 2026-05-19
**Base SHA:** `09547d9379260ea4a5076902d1566d948e6f7290`
**Tracks:** 4 (track assignment decoupled — any session executes any unclaimed track via `/sprint --session <alias> --track <name> <this-plan-file>`)
**Close:** Any session calls `/parallel-sprint-close docs/plans/2026-05-19-parallel-4-ci-velocity.md` after all tracks have written outcome.json sidecars.

## Theme

CI/CD wall-time reduction via four file-disjoint config edits. TD-195 (conditional E2E) + TD-197 (tRPC snapshots) just landed — this sprint stacks the remaining incremental wins.

## Disjoint-ness verified

| Track | Owned files |
|---|---|
| A (TD-198) | `.github/workflows/ci.yml` |
| B (TD-199) | `turbo.json`, `package.json` (root) |
| C (TD-200) | `apps/web/vitest.config.ts` |
| D (TD-201) | `playwright.config.ts` (root) |

Pair-intersection (every pair):
- A ∩ B = ∅ ✅
- A ∩ C = ∅ ✅
- A ∩ D = ∅ ✅
- B ∩ C = ∅ ✅
- B ∩ D = ∅ ✅
- C ∩ D = ∅ ✅

**Shared finalizer-only files:** `BACKLOG.md` (§0 status board), `CONTEXT.md` (additive only). Tracks A–D MUST NOT touch these.

**Forbidden-shared check:** none found. No source modules, schemas, configs, or test files appear in 2+ tracks' file lists.

## Executor contract (applies to all 4 tracks)

Each track-executor session MUST:

1. **`cd <worktree>`** at session start; never operate from repo root.
2. **`git branch --show-current`** before every commit; abort if it doesn't match the assigned branch (per global "Multi-Session Discipline" rule 2).
3. **Stage explicit file lists** (`git add <files>`) — NEVER `git add .` or `git commit -a`. Multi-session HEAD swaps can leak unrelated changes.
4. **Pre-granted Bash patterns** (no permission prompts needed): `gh pr create`, `gh pr merge --auto --squash`, `gh pr view`, `git push -u origin <branch>`, `pnpm`, `npx`, `cd`, `grep`, `cat`, `ls`.
5. **Heartbeat clause** — append a timestamp every ~5 min to `.claude/agent-status/td-<id>.log` (per global Worktree & Subagent Conventions rule 3).
6. **Diff summary in PR body** — list files changed + intentionally-NOT-changed.
7. **Pre-commit local verification** — run the project test/typecheck commands listed in the track's Acceptance section before committing; `--no-verify` allowed ONLY when the documented pnpm + worktree env mismatch reproduces with changes stashed (see `.claude/CLAUDE.md` Known Gotchas).

## Worktrees (pre-created)

- Track A: `worktrees/td-198-vitest-split-pgtap-fastskip/` (branch `feat/td-198-vitest-split-pgtap-fastskip`)
- Track B: `worktrees/td-199-turbo-cache-config/` (branch `feat/td-199-turbo-cache-config`)
- Track C: `worktrees/td-200-vitest-pool-tune/` (branch `feat/td-200-vitest-pool-tune`)
- Track D: `worktrees/td-201-playwright-workers/` (branch `feat/td-201-playwright-workers`)

All four worktrees branch from base SHA `09547d9379260ea4a5076902d1566d948e6f7290` (origin/main at plan time).

## Track A — TD-198 — Split vitest into 3 parallel project-jobs + pgTAP paths-filter fast-skip

**Worktree:** `worktrees/td-198-vitest-split-pgtap-fastskip/`
**Branch:** `feat/td-198-vitest-split-pgtap-fastskip`

**Files allowed:**
- `.github/workflows/ci.yml`

**Files out of scope — DO NOT TOUCH:**
- `turbo.json`, root `package.json` (Track B owns)
- `apps/web/vitest.config.ts` (Track C owns)
- `playwright.config.ts` (Track D owns)
- `BACKLOG.md`, `CONTEXT.md` (finalizer-only)
- All other application code

**Verified facts (do NOT re-discover):**
- `changes` job (lines 42–66) already exposes outputs: `web`, `mobile`, `supabase`, `deps`, `e2e`, `e2e-required`. The `deps` bucket already covers `.github/workflows/**` (the filter list at line 67 includes `.github/workflows/**`). **There is NO `workflow` output** — do NOT reference `needs.changes.outputs.workflow`.
- `rls-tests` is at line 250 and **already has** an `if:` block at lines 255–257: `if: github.event_name == 'merge_group' || needs.changes.outputs.supabase == 'true'`. Track A **EXTENDS** this gate; it does not create a new one.

**Implementation steps:**
1. Locate the `web-tests` job (line 151) in `ci.yml`. Convert to a matrix job: `strategy.matrix.project: [web, node, a11y]` with `fail-fast: false`. Each runs `npx vitest run --project=${{ matrix.project }}` in `apps/web`. Update the job name template to `Web — ${{ matrix.project }}` for readable check rows.
2. Locate the existing `if:` block on the `rls-tests` job (lines 255–257). **EXTEND** it by appending ` || needs.changes.outputs.deps == 'true'` so workflow-self-edits and lockfile changes also trigger pgTAP. Do NOT duplicate the block.
3. Update `ci-summary` job (line 385) to treat `skipped` `rls-tests` as success when the path-filter gated it, NOT as failure (same pattern TD-195 applied to E2E).
4. Do NOT add new paths-filter buckets, do NOT touch the `changes` job's filter list, and do NOT modify other workflows. Scope is strictly the `web-tests` matrix conversion + the `rls-tests` `if:` EXTENSION + the `ci-summary` skip-as-success update.

**Acceptance (verifiable):**
- `gh pr checks <pr>` shows 3 `Web — <project>` rows running in parallel for any web/* diff.
- A docs-only PR (no `supabase/**`, no `pnpm-lock.yaml`, no workflow/package changes) has `rls-tests` skipped AND `ci-summary` green.
- A `supabase/**` change has `rls-tests` running.
- A workflow-self-edit PR (touches `.github/workflows/**`) re-triggers `rls-tests` via the `deps` bucket.
- `grep -E "outputs.workflow" .github/workflows/ci.yml` returns no matches (sanity check: do not introduce a `workflow` output).

**Risk + mitigations:** RLS regression slipping through skip path — mitigated by force-run allowlist breadth and pgTAP nightly (when added in a future TD). Matrix flake — `fail-fast: false`.

## Track B — TD-199 — Turborepo cache config for typecheck + lint

**Worktree:** `worktrees/td-199-turbo-cache-config/`
**Branch:** `feat/td-199-turbo-cache-config`

**Files allowed:**
- `turbo.json`
- `package.json` (root)

**Files out of scope — DO NOT TOUCH:**
- `apps/web/package.json` (would conflict with Track A's CI invocation if it changed scripts)
- `apps/mobile/package.json`, `packages/*/package.json`
- `.github/workflows/ci.yml` (Track A owns)
- `apps/web/vitest.config.ts` (Track C owns)
- `playwright.config.ts` (Track D owns)
- `BACKLOG.md`, `CONTEXT.md` (finalizer-only)
- All other application code

**Verified facts (do NOT re-discover):**
- Root `package.json` already defines: `"lint": "turbo lint"` and `"type-check": "turbo type-check"` (hyphenated). CI calls `pnpm type-check` at `ci.yml:111`. Do **NOT** add a new un-hyphenated `typecheck` script.
- `turbo.json` already has **existing task blocks** for `lint` (with `dependsOn: ["^lint"]`) and `type-check` (with `dependsOn: ["^build"]`). Track B **MERGES `inputs` + `outputs: []` into the existing blocks**; it does NOT add new task entries.
- The existing `type-check.dependsOn: ["^build"]` is wasteful (type-check does not need build artifacts) and prevents cache hits from showing as `>>> FULL TURBO` on a clean second run. Track B **REMOVES** `dependsOn` from `type-check` only. Keeps `dependsOn` on `lint` (semantically reasonable — root lint waits on workspace lints).

**Implementation steps:**
1. Open `turbo.json`. **Modify the existing `type-check` block** to:
   ```json
   "type-check": {
     "inputs": ["**/*.ts", "**/*.tsx", "tsconfig*.json", "package.json"],
     "outputs": []
   }
   ```
   (removes `dependsOn: ["^build"]`; adds `inputs` + `outputs: []`).
2. **Modify the existing `lint` block** to:
   ```json
   "lint": {
     "dependsOn": ["^lint"],
     "inputs": ["**/*.{ts,tsx,js,jsx,mjs}", "eslint.config.mjs", ".eslintrc*", "package.json"],
     "outputs": []
   }
   ```
   (keeps `dependsOn`; adds `inputs` + `outputs: []`).
3. Do NOT touch root `package.json` — the existing `"lint": "turbo lint"` and `"type-check": "turbo type-check"` scripts already route through these tasks.
4. Verify locally: `pnpm type-check` runs (no error), then `pnpm type-check` a second time shows `>>> FULL TURBO` or per-package `cache hit, replaying logs`. Same for `pnpm lint`.

**Acceptance (verifiable):**
- `jq '.tasks["type-check"].inputs | length' turbo.json` returns a non-zero integer.
- `jq '.tasks["type-check"].dependsOn' turbo.json` returns `null` (dependsOn was removed).
- `jq '.tasks.lint.inputs | length' turbo.json` returns a non-zero integer.
- `jq '.tasks.lint.dependsOn' turbo.json` returns `["^lint"]`.
- `pnpm type-check && pnpm type-check` — second invocation prints `>>> FULL TURBO` or per-package `cache hit, replaying logs`.
- `pnpm lint && pnpm lint` — same.
- `git diff package.json` shows no changes (root scripts unchanged).

**Risk + mitigations:** Cache invalidation on input-glob mismatch (e.g. tests passing because cache hit on stale source) — mitigated by explicit `inputs` lists that include the source globs; `outputs: []` means no artifacts to stale.

## Track C — TD-200 — Vitest node + a11y project pool tuning

**Worktree:** `worktrees/td-200-vitest-pool-tune/`
**Branch:** `feat/td-200-vitest-pool-tune`

**Files allowed:**
- `apps/web/vitest.config.ts`

**Files out of scope — DO NOT TOUCH:**
- `apps/web/package.json` (no script changes needed)
- `apps/web/vitest.setup.ts` and `vitest.setup.node.ts` (setup files — leave alone)
- `.github/workflows/ci.yml` (Track A owns)
- `turbo.json`, root `package.json` (Track B owns)
- `playwright.config.ts` (Track D owns)
- `BACKLOG.md`, `CONTEXT.md` (finalizer-only)
- All other application code

**Verified facts (do NOT re-discover):**
- The **a11y** project uses `environment: "jsdom"` (apps/web/vitest.config.ts:line ~133–145). jsdom + threads pool is documented-fragile in vitest 4.x (DOM globals can leak across thread-pool workers). a11y is intentionally OUT OF SCOPE for this track.
- The **browser** project's `fileParallelism: false` (lines 56–58) is load-bearing for the single-chromium-instance constraint. OUT OF SCOPE.

**Implementation steps:**
1. Inside the **node** project's `test:` block ONLY, add a single line:
   ```ts
   pool: "threads",
   ```
   Do NOT add `poolOptions` — vitest's defaults under `threads` already enable file-level parallelism. Setting `singleThread: false` is a no-op signal that adds noise. If a future change needs explicit thread-count caps, add `minThreads`/`maxThreads` in a follow-up TD.
2. Do NOT change the **a11y** project. jsdom + threads is fragile; the a11y project's ~10 short test files do not justify the risk. Leave it on vitest's default pool (`forks`).
3. Do NOT change the **browser** project. Its `fileParallelism: false` is load-bearing.
4. Run `cd apps/web && npx vitest run` locally and confirm all tests still pass (2333 at baseline).

**Acceptance (verifiable):**
- `grep -A 6 'name: "node"' apps/web/vitest.config.ts | grep -E 'pool: "threads"'` returns the new config.
- `grep -A 6 'name: "a11y"' apps/web/vitest.config.ts | grep -E 'pool:'` returns NO matches (a11y stays on default pool).
- Full vitest suite green (2333 tests at baseline; should remain 2333).
- Browser project's `fileParallelism: false` line is unchanged.

**Risk + mitigations:** Thread-pool incompatibility with a test that relies on fork-only globals — mitigated by running the full suite locally; node project tests are pure-functions / server-router unit tests with no fork-specific state. a11y kept on default pool to avoid known jsdom + threads fragility.

## Track D — TD-201 — Playwright workers + fullyParallel config

**Worktree:** `worktrees/td-201-playwright-workers/`
**Branch:** `feat/td-201-playwright-workers`

**Files allowed:**
- `playwright.config.ts` (repo root)

**Files out of scope — DO NOT TOUCH:**
- `e2e/**` test files
- `.github/workflows/ci.yml` (Track A owns)
- Any other workflow file
- `turbo.json`, root `package.json` (Track B owns)
- `apps/web/vitest.config.ts` (Track C owns)
- `BACKLOG.md`, `CONTEXT.md` (finalizer-only)
- All other application code

**Verified facts (do NOT re-discover):**
- `playwright.config.ts` currently has `fullyParallel: false` on line 21 and `workers: 1` on line 23. Track D **REPLACES** both lines, it does not add duplicates.

**Implementation steps:**
1. Open `playwright.config.ts` (root).
2. **Replace line 21** `fullyParallel: false,` with `fullyParallel: true,`.
3. **Replace line 23** `workers: 1,` with `workers: process.env.CI ? 2 : undefined,`.
4. Run `pnpm exec playwright test --list 2>&1 | tail -10` to confirm the config still parses and the test count is unchanged from baseline.

**Acceptance (verifiable):**
- `grep -E "^  workers: process\.env\.CI \? 2 : undefined," playwright.config.ts` returns exactly one match.
- `grep -E "^  fullyParallel: true," playwright.config.ts` returns exactly one match.
- `grep -E "workers: 1," playwright.config.ts` returns NO matches (old line is gone).
- `grep -E "fullyParallel: false," playwright.config.ts` returns NO matches (old line is gone).
- `pnpm exec playwright test --list` exits 0 with the same test count as on main.

**Risk + mitigations:** Worker count too high for the runner SKU causing OOM — mitigated by capping at 2 (conservative on 2-core GHA runners). `fullyParallel: true` may surface previously-hidden test ordering dependencies — mitigated by running the full e2e suite locally before opening PR.

## Merge order

All four tracks land independently. No track depends on another. After all four merge, CI velocity improvements stack:
- Track A's matrix consumes Track C's pool-tuned config.
- Track A's `turbo run` consumers (if any added later) consume Track B's cache config.
- Track A's pgTAP fast-skip stands alone.
- Track D's worker tuning applies to Track A's existing 3-shard Playwright jobs.

## Execution gate

`/opus-on-opus docs/plans/2026-05-19-parallel-4-ci-velocity.md --from-sprint` runs as part of plan authoring. Apply any Must-fix findings before executor sessions start.

## Per-track close protocol

When all four tracks have written `.claude/state/sessions/<alias>/outcome.json` (status: "complete"), any session calls:

```
/parallel-sprint-close docs/plans/2026-05-19-parallel-4-ci-velocity.md
```

The close skill absorbs all outcomes, performs the SINGLE BACKLOG.md edit + tail `/backlog-sync` + claims.json + INDEX.md cleanup. Per-track session dirs are deleted last.
