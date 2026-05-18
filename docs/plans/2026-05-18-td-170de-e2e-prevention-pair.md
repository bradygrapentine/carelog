# TD-170d — E2E string-drift lint rule (prevention)

**Date:** 2026-05-18
**Source backlog:** TD-170d (P2 lint rule)
**Sprint slug:** td-170de-e2e-prevention-pair (slug retained for state continuity)
**Base SHA:** 70c4c65 (post-#609 merge)
**Execution mode:** direct (single track — TD-170e split off per /opus-on-opus SF4)
**Theme:** lock down the UX-04x copy-audit regression class so the next copy-audit PR can't repeat the TD-170b/c arc

**TD-170e shipped separately as PR #610** (1-line testid swap, instant hotfix). This plan covers TD-170d only.

## Why this matters

The TD-170b/c arc (4 PRs, ~3 hours of session time) was caused by 3 sibling copy-audit PRs landing on 2026-05-15 that renamed UI strings without sweeping E2E. The cost-per-incident was high, and the next UX copy-audit will repeat the pattern unless we add a guard. TD-170d is that guard. TD-170e is the leftover tactical fix that restores E2E [2/3] green.

## Scope contract

```
FILES ALLOWED:
  - scripts/check-e2e-string-drift.mjs                (new)
  - .github/workflows/ci.yml                          (add job)
  - package.json                                       (root — add npm script; NOT apps/web/)
  - scripts/__tests__/check-e2e-string-drift.test.mjs (new — node:test unit tests)
BRANCH: chore/td-170d-e2e-string-drift-lint
DO NOT:
  - touch BACKLOG.md (BACKLOG-as-SoT)
  - touch any apps/web/app/** source
  - touch e2e/ specs (detector-only — never modifies tests)
PHI RULE: n/a — test infra
VERIFY: Acceptance below
```

### Design

**Trigger:** PR-time check (CI job, NOT pre-commit — pre-commit would slow every commit globally).

**Algorithm (single-pass, cross-file move-aware):**

1. **Resolve diff base.** `BASE=${GIT_DIFF_BASE:-origin/main}` — env override enables retro-validation per Acceptance #8. Default `origin/main` for production CI use.
2. `git diff $BASE...HEAD --name-only` → file list. Filter to `apps/web/**/*.{ts,tsx}` (UI surface). Exclude `**/__tests__/**` (vitest unit tests, not E2E).
3. **Global ADDED-strings pre-pass (cross-file).** `git diff $BASE...HEAD` for the entire PR (all files together, NOT looped per-file) → extract ALL `+` lines → run candidate-extraction regex → build `addedStrings: Set<string>`. This MUST happen before step 4 so the move-detector at step 5 can see strings moved across files.
4. **Per-file REMOVED-strings pass.** For each filtered file: `git diff $BASE...HEAD -- <file>` → extract `-` lines → run candidate-extraction regex → build `removedPerFile: Map<file, Array<{ string, line }>>`.
5. **Move detection.** For each removed string, if it's in the global `addedStrings` set → SKIP (refactor/move, not rename).
6. **E2E grep with quote/word-boundary precision (Must-fix #3 — NOT `grep -F`).** For each remaining removed-string candidate, invoke `grep -rEn '("|\x27)<escaped-string>("|\x27)' e2e/` — requires the matched literal to be inside a JS/TS string literal (`"..."` or `'...'`). Also covers Playwright `text=<string>` engine via the trailing-quote-or-EOL variant. Stops "Share update" false-matching against "Sharepoint" / "Shareable".
7. If any match → emit `❌ apps/web/.../foo.tsx:NN removed string "<old>" still referenced in e2e/bar.spec.ts:MM:<line>`. Aggregate ALL findings then exit 1 (no per-file early-exit).
8. **Case sensitivity.** Removed-string match against e2e/ is CASE-SENSITIVE (Playwright selectors are case-sensitive by default). Document in script header.

**Magic-comment scoping (Must-fix follow-up SF2).** A PR-author opts out per-string by placing a comment in ANY file in the PR's diff (per-PR scope). Comment must be either (a) an ADDED line in the diff, OR (b) within ±3 lines of a REMOVED line that contains the string. Match shape: `// e2e:no-references "<exact-string>"` — exact-quoted match, one string per comment. Script greps the PR's full diff for these comments before step 5.

**Allowlist mechanism:** PR-author can add a magic comment to opt out per-string:
```ts
// e2e:no-references — "Old string" was a button label removed in this PR; no test references it.
```
Script greps for `e2e:no-references` comments in the PR's diff; matching strings skip the check.

**False-positive controls:**
- Strings with only 1 word OR ≤4 chars → skip (too noisy)
- Strings matching `^[A-Z_]+$` (all caps) → skip (likely enum names or constants)
- Strings appearing in `__tests__/` directories → skip (vitest unit tests, not E2E)
- Removed strings that ALSO appear added in the same diff (move, not rename) → skip

### CI integration

Add a new job to `.github/workflows/ci.yml`:
```yaml
e2e-string-drift:
  name: E2E string drift
  needs: [changes]
  if: needs.changes.outputs.web == 'true'   # only run on web-touching diffs
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      with: { fetch-depth: 0 }   # need full history for git diff
    - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
      with: { node-version: 22 }
    - run: node scripts/check-e2e-string-drift.mjs
```

Add npm script in root `package.json`: `"check:e2e-drift": "node scripts/check-e2e-string-drift.mjs"`.

### Unit tests

`scripts/__tests__/check-e2e-string-drift.test.mjs` (node:test framework, no vitest dep needed):
1. Test fixture: synthetic diff with removed string → grep finds it in fake e2e/ → expect exit 1.
2. Test fixture: synthetic diff with removed string + `e2e:no-references` opt-out → expect exit 0.
3. Test fixture: removed string also added (move) → expect exit 0.
4. Test fixture: removed string is ≤4 chars or all-caps → expect exit 0 (filtered).
5. Test fixture: removed string not referenced in e2e/ → expect exit 0.

### Acceptance

1. Workflow job runs on every PR that touches `apps/web/`.
2. Script exits non-zero when a real UX-04x-style drift is introduced (verified by unit tests with synthetic diffs covering all 3 known drifts: "Share update", "Thanks! You're helping out.", "No billing history yet.").
3. Script exits zero when no E2E references exist for renamed strings.
4. Opt-out via magic comment works (unit test covers per-PR scope; missing-comment case still fails).
5. Move detection works: string moved file A → file B in same PR exits zero (unit test).
6. Word-boundary correctness: removed string "Share update" does NOT false-positive against e2e files containing "Shareable" / "Sharepoint" (unit test).
7. Unit tests pass (`node --test scripts/__tests__/check-e2e-string-drift.test.mjs`).
8. **Retro-active validation:** run `GIT_DIFF_BASE=<pr-parent-sha> node scripts/check-e2e-string-drift.mjs` against the 3 PRs that caused TD-170b/c (#525, #528, #529) by checking out each merge SHA and verifying the script catches the drift. The env-var override unblocks this (SF3). Document results in PR body — should show 4-5 drifts caught across the 3 PRs.
9. Script file ≤200 lines (per global harness-size convention).
10. NOT a required check in v1; promote to required after one week of clean runs.

## Merge order

Single PR. Auto-merge armed at open. TD-170e shipped separately as PR #610 (1-line testid swap).

## Out of scope (file-and-watch)

- **Deduplicate the actual dual-button in `apps/web/components/medication/`.** This sprint fixes the test; the UX cleanup of the duplicate button is separate (file as a new UX-* row if a designer cares — the testid one is functional but lower-affordance text).
- **Pre-commit hook variant of TD-170d.** Slows every commit globally; CI-only is the right tier for v1.
- **Allowlist for "permanent" string overlaps.** Magic comment + careful regex should handle the cases; revisit only if false-positive rate is bad after a week.

## Risks accepted

- **TD-170d may false-positive.** The capitalized-string heuristic is imperfect (e.g. "TODO" comment text could match). Mitigation: keep it non-required for one week; tune the regex if real PRs trip on it.
- **TD-170e fix verifies via CI only.** Can't sanity-check the testid exists without running E2E; the failed-CI log already confirms the testid attribute is present (`<button data-testid="add-medication-btn">`). Low risk.
- **The dual-button UX is left alone.** Two buttons with overlapping accessible names is a low-affordance issue but not a regression — it predates the TD-170 saga.

## /oop dimensions to watch (post-merge)

- Script encapsulation — keep diff-parser, candidate-extractor, move-detector, allowlist-parser, e2e-grepper as 5 separate pure functions for testability.
- Regex maintainability — `QUOTED` and `JSX_TEXT` regexes as named constants at file top, not inlined; documented with passing + failing examples in adjacent comment.
- Single-pass discipline — global added-strings set built ONCE, not rebuilt per-file (move detection breaks if rebuilt per-file).
