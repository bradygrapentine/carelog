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

**Implementation steps:**
1. Locate the `web-tests` job (line 151) in `ci.yml`. Convert to a matrix job: `strategy.matrix.project: [web, node, a11y]` with `fail-fast: false`. Each runs `npx vitest run --project=${{ matrix.project }}` in `apps/web`. Update the job name template to `Web — ${{ matrix.project }}` for readable check rows.
2. Verify the `changes` job's `dorny/paths-filter` step exposes a `supabase` output bucket; if not (TD-195 landed only the listed buckets), add `supabase: ['supabase/**']` to the filter.
3. Locate the `rls-tests` job (line 250). Add `if: github.event_name == 'merge_group' || needs.changes.outputs.supabase == 'true' || needs.changes.outputs.deps == 'true' || needs.changes.outputs.workflow == 'true'` (mirror TD-195's `e2e` `if` shape — include workflow-self-edit force-run).
4. Update `ci-summary` job (line 385) to treat `skipped` `rls-tests` as success when the path-filter gated it, NOT as failure (same pattern TD-195 applied to E2E).

**Acceptance (verifiable):**
- `gh pr checks <pr>` shows 3 `Web — <project>` rows running in parallel for any web/* diff.
- A docs-only PR has `rls-tests` skipped AND `ci-summary` green.
- A `supabase/**` change has `rls-tests` running.
- The `force-run` allowlist (workflow self-edit) re-triggers `rls-tests` even on a docs-only PR.

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

**Implementation steps:**
1. Open `turbo.json`. Inside `tasks`, add:
   ```json
   "typecheck": {
     "inputs": ["**/*.ts", "**/*.tsx", "tsconfig*.json", "package.json"],
     "outputs": []
   },
   "lint": {
     "inputs": ["**/*.{ts,tsx,js,jsx,mjs}", "eslint.config.mjs", ".eslintrc*", "package.json"],
     "outputs": []
   }
   ```
2. Open root `package.json`. Add scripts:
   ```json
   "typecheck": "turbo run typecheck",
   "lint": "turbo run lint"
   ```
   If these scripts already exist with different bodies, leave them alone and document in PR description.
3. Verify `pnpm typecheck` from repo root completes successfully and a second run shows cache HIT for unchanged packages.

**Acceptance (verifiable):**
- `grep -E '"typecheck"' turbo.json` returns the new task block.
- `pnpm typecheck && pnpm typecheck` — second invocation prints `>>> FULL TURBO` or per-package cache HIT lines.
- `grep -E '"typecheck":.*turbo' package.json` (root) returns the new script.

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

**Implementation steps:**
1. Inside the **node** project's `test:` block, add:
   ```ts
   pool: "threads",
   poolOptions: { threads: { singleThread: false } },
   ```
2. Inside the **a11y** project's `test:` block, add the same `pool` + `poolOptions`.
3. Do NOT change the **browser** project. Its `fileParallelism: false` is load-bearing (single chromium instance — comment at lines 56–58 explains).
4. Run `cd apps/web && npx vitest run` locally and confirm all tests still pass.

**Acceptance (verifiable):**
- `grep -A 2 'name: "node"' apps/web/vitest.config.ts | grep -E "pool.*threads"` returns the new config.
- Full vitest suite green (2333 tests at baseline; should remain 2333).
- Browser project's `fileParallelism: false` line is unchanged.

**Risk + mitigations:** Thread-pool incompatibility with a test that relies on fork-only globals — mitigated by running the full suite locally; node project tests are pure-functions / server-router unit tests with no fork-specific state.

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

**Implementation steps:**
1. Open `playwright.config.ts` (root). Add or update the top-level config object:
   - `workers: process.env.CI ? 2 : undefined`
   - `fullyParallel: true`
2. If either key already exists with a different value, do NOT change it without first confirming the existing value's rationale in code comments / git blame. Document in PR description.
3. Run `pnpm exec playwright test --list 2>&1 | tail -5` to confirm the config still parses.

**Acceptance (verifiable):**
- `grep -E "workers.*CI.*2" playwright.config.ts` returns the new line.
- `grep -E "fullyParallel.*true" playwright.config.ts` returns the new line.
- `pnpm exec playwright test --list` exits 0.

**Risk + mitigations:** Worker count too high for the runner SKU causing OOM — mitigated by capping at 2 (conservative on 2-core GHA runners).

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
