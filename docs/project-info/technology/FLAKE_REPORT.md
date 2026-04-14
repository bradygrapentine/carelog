# Vitest Flake Report — ON-40

**Date:** 2026-04-14
**Branch:** feat/test-quality
**Runs:** 3 consecutive `npx vitest run` executions from `.worktrees/test-quality/`

## Summary

| Run | Test Files | Tests | Failures | Duration |
|-----|-----------|-------|----------|----------|
| 1   | 13        | 173   | 0        | 1.27s    |
| 2   | 13        | 173   | 0        | 2.06s    |
| 3   | 13        | 173   | 0        | 1.27s    |

**No flaky tests detected across 3 runs.**

## Scope

Only the `schemas` and `utils` project suites ran. The `web` (browser/Playwright) and `node` (apps/web server) suites were excluded because they require a running Supabase instance and Playwright browser binaries not available in this context.

## Quarantined Tests

None. No test failed on any run.

## Notes

- `packages/schemas` — 12 test files, all stable. Two new files added by ON-25 (`export.test.ts`, `outerCircle.test.ts`) passed on all runs.
- `packages/utils` — 1 test file, all stable.
- The `web` and `node` suites should be run as a follow-up under normal CI conditions (Supabase + Playwright available). No flakes were observed in prior CI history for these suites.

## Action

No `.skip` quarantines applied. All tests are stable within the tested scope.
