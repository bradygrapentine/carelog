# parallel-2-ci-velocity — TD-197 (Track B only, re-seed)

**Date:** 2026-05-19 (re-seeded; original plan was never committed before finalizer #640 ran)
**Base SHA:** cc8cc26946553c311f94b9e21f45aff0129af728
**Source backlog:** TD-197
**Track A (TD-195) status:** not part of this re-seed — left as a separate Ready row in §1.
**Recommended executor:** track-executor mode, single track (Track B).

## Goal

Add tRPC router Zod-schema snapshot tests as a fast contract-drift guard at the unit-test layer. Catches input/output shape changes per-procedure without depending on E2E. Pairs with TD-195 (when conditional E2E skips a PR, this still runs).

## Non-goals

- TD-195 CI gating (separate row, separate PR).
- Middleware or RLS coverage (pgTAP + E2E own that).
- Migration to Pact (TD-196, deferred).

## Tracks

### Track B — TD-197 — tRPC Zod-schema snapshots

**Worktree:** `worktrees/td-197-trpc-schema-snapshots/`
**Branch:** `feat/td-197-trpc-schema-snapshots` off base SHA above.

**FILES ALLOWED (create/modify):**
- `apps/web/server/routers/__tests__/schema-snapshot.test.ts` (NEW)
- `apps/web/server/routers/__tests__/__snapshots__/api-schemas.snap.json` (NEW)
- `apps/web/server/routers/__tests__/test-helpers/schema-walker.ts` (NEW)
- `apps/web/server/routers/__tests__/test-helpers/__tests__/schema-walker.test.ts` (NEW)
- `apps/web/package.json` (add `zod-to-json-schema` to devDependencies; no other edits)
- `apps/web/server/api-version.ts` (NEW — `export const API_VERSION = "1.0.0"`)
- `docs/adr/0006-trpc-schema-snapshots.md` (NEW)
- `pnpm-lock.yaml` (regenerated)

**FILES OUT OF SCOPE — DO NOT TOUCH:**
- `BACKLOG.md`, `CONTEXT.md` (finalizer-only).
- tRPC router source files under `apps/web/server/trpc/` and `apps/web/server/routers/*.ts` (read-only — we snapshot them, don't change them).
- All other app code, vitest specs, CI workflows.
- Track A's would-be files: `.github/workflows/**`, `scripts/ci-paths-filter-test.mjs`.

**Implementation steps:**
1. `pnpm -F web add -D zod-to-json-schema` (regenerates lockfile).
2. Create `apps/web/server/api-version.ts` exporting `API_VERSION = "1.0.0"` with a doc-comment naming the snapshot bump protocol.
3. Build pure walker in `test-helpers/schema-walker.ts` that takes the `appRouter` and emits `{ "<router>.<procedure>": { type: "query"|"mutation"|"subscription", input: JsonSchema | null, output: JsonSchema | null } }`. Handles nested routers via recursion on `_def.record`.
4. Unit-test the walker against a synthetic mini-router covering: nested routers, no-input procedures, query/mutation/subscription detection, AND an intentional-drift fixture proving the diff message names the field path and hints at API_VERSION bump.
5. Main spec walks real `appRouter`, compares against baseline JSON file, fails-with-helpful-message on drift.
6. Generate the baseline by running the spec once with a `UPDATE_SCHEMA_SNAPSHOT=1` env guard (or write-on-first-run).
7. Write ADR 0006 documenting convention + known-lossy patterns (`z.record(z.unknown())`, `z.lazy`, `z.brand`) + API_VERSION bump protocol.

**Acceptance (verifiable):**
- `cd apps/web && npx vitest run server/routers/__tests__/schema-snapshot` exits 0.
- `cat apps/web/server/routers/__tests__/__snapshots__/api-schemas.snap.json | jq 'keys | length'` ≥ number of routers in `appRouter` (currently 24 routers, multiple procedures each → ≥30 keys is a safe floor).
- `grep -E "careEvents\." apps/web/server/routers/__tests__/__snapshots__/api-schemas.snap.json` returns ≥1 entry (guards the `z.record(z.unknown())` lossy case in careEvents).
- Walker drift test asserts diff output contains both the field path AND the substring "API_VERSION".
- New PR CI green.

**Risk + mitigations:**
- Lossy Zod features collapse to `{}` in JSON Schema — documented in ADR with explicit list; helper-tests pin behavior so silent regressions don't slip in.
- pnpm + worktree env mismatch may force `--no-verify` on commit — fine per documented gotcha; CI validates.

## Merge order

Single track; merge directly on green.

## Execution gate

Implementation already adversarial-reviewed via prior /opus-on-opus cycles on the deleted plan version (Must-fix: 0). Re-running is unnecessary for a re-seed unless the implementation diverges materially.

## Post-merge

- `/parallel-sprint-close docs/plans/2026-05-19-parallel-2-ci-velocity.md` cleans state.
- TD-195 remains in §1 Ready for a future sprint.
