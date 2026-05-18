# TD-170b — E2E chronic-red root-cause investigation

**Date:** 2026-05-18
**Investigator:** Claude (Opus 4.7) via `/sprint td-170b-e2e-investigation`
**Plan:** `docs/plans/2026-05-18-td-170b-e2e-investigation.md`
**Base SHA:** bfefc23 (post-#604 merge)
**Verdict:** **HIGH confidence — selector drift from PR #529 (UX-050) on 2026-05-15. Two button/placeholder strings renamed; 54 E2E callsites still reference the old strings.**

## Summary (3 sentences)

E2E has been red since 2026-05-15. PR #529 (UX-050) renamed two journal-page UI strings (`"Share update"` → `"Post to journal"` button; `"Share how today went..."` → `"What happened today? Even one line is enough."` placeholder), updated 2 vitest unit tests, and missed 54 E2E callsites across 11 spec files. PR #592 (TD-170) on 2026-05-17 fixed a third drifted string (`/Verify code/`) but did not sweep these two — explaining why CI stayed red post-fix.

## Regression window + last-known-green

- **Last known-green CI on main:** `05ad945` @ 2026-05-15T20:40Z
  - Run: https://github.com/bradygrapentine/carelog/actions/runs (CI workflow, success)
- **First red run after window opens:** post-`76ff507` (PR #529 merge at 2026-05-15T17:17Z + subsequent sibling merges); CI flipped persistently red the next morning.
- **Window length:** 3 days, ~12 merged PRs, 1 root cause (PR #529).

## Failed-run characteristics

**Sample failed run inspected:** `26014208559` (https://github.com/bradygrapentine/carelog/actions/runs/26014208559) on chore/td-87-housekeeping (PR #604), 2026-05-18T04:55Z.

E2E shards [1/3], [2/3], [3/3] all failed (job IDs 76460845855, 76460845852, 76460845866). Failure mode is uniform:

```
× e2e/auth-journal.spec.ts:9:5 — sign in and navigate to journal — entry form loads
    expect(locator).toBeVisible() failed
    Timeout: 5000ms
    Error: element(s) not found
    at e2e/auth-journal.spec.ts:13:66

× e2e/auth-journal.spec.ts:16:5 — create a journal entry and verify it appears in timeline
    locator.click: Test timeout of 90000ms exceeded.
       28 |   await page.click("text=Share update");
    at e2e/auth-journal.spec.ts:25:18
```

The failure is **NOT** `page.waitForURL` (the TD-170 hypothesis). It is `waitForSelector` / `click` on string literals that no longer exist in the rendered DOM.

## Hypothesis ranking

| # | Hypothesis | Confidence | Evidence |
|---|---|---|---|
| H1 | Supabase JWT-mint env drift from SEC-001 | **RULED OUT** (pre-sprint) | `ci.yml:270–296` mints local HS256 JWT in-step against `localhost:54321` Supabase CLI; SEC-001 prod-secret rotation cannot mechanically affect this job |
| **H5** | **Additional selector drift beyond TD-170 fix** | **HIGH** | **`grep -rn "Share update" e2e/` returns 18 callsites across 10 spec files; the string does not exist in `apps/web/app/` or `apps/web/components/`. `git log --all -S "Share update" -- apps/web/` → commit `76ff507` (PR #529, UX-050, 2026-05-15) renamed `Share update` → `Post to journal` in `apps/web/app/(app)/journal/[recipientId]/JournalEntryForm.tsx`. Second drifted string: `Share how today went...` placeholder, 5+ E2E callsites, same PR. PR description: "7 §4 copy edits + 6 label-rename sites + 2 test files updated" — the "2 test files" were vitest, NOT Playwright E2E.** |
| **H8** | **PR #592 fix insufficient — multi-selector drift from one UI PR** | **HIGH** | Confirms H5 via PR #592 history: TD-170 fixed `/Verify code/` (one drifted selector); PR #529 actually drifted THREE selectors (Verify code in sign-in flow + Share update button + placeholder). The pattern (one UI PR drifting multiple E2E callsites) is exactly the H8 prediction. |
| H7 | Stale artifacts / cache | **RULED OUT** | E2E job has no `actions/cache` for `node_modules` or `~/.cache/ms-playwright` in `ci.yml`. Every shard does a fresh `pnpm install --frozen-lockfile` + Playwright re-install per matrix run. No cache-key staleness possible. Failure source is in-repo (committed test code referencing removed strings), not infra. |
| H2 | Playwright timing on Next 16 streaming | **RULED OUT** | Failure is `element(s) not found` after 5000ms `waitForSelector` AND 90000ms `click` timeout — both timeouts are well beyond any reasonable render delay. The element doesn't exist at all, not "slow to appear." Timing-shaped hypotheses don't apply to missing-element failures. |
| H3 | Vercel preview env race vs locally-served build | **RULED OUT** | No `.env*` in `apps/web/` is committed; build's env vars come exclusively from `$GITHUB_ENV` minted in-step. No external secret pull during install or build. App starts and renders the journal page successfully — the user reaches the post-sign-in surface; the button on that surface is just renamed. Env race would manifest as auth/connection error pre-render, not selector-not-found post-render. |
| H4 | `signInWithOtp` 429 from shared CI egress | **RULED OUT** | Failure happens AFTER sign-in succeeds (test reaches `await page.click("text=Share update")` which is post-auth). If `signInWithOtp` 429'd, the test would die at the sign-in step, not at the share-button click. Local Supabase CLI is used by E2E anyway — separate rate-limit pool from prod. |
| H6 | Next 16 middleware cookie-domain mismatch | **RULED OUT** | Same reasoning as H4 — user reaches the post-auth page successfully; cookies are persisting fine. Failure is on a UI element that no longer exists, not a redirect-loop or session-loss symptom. |

**Bar met:** 2 HIGH-confidence + 6 RULED-OUT (5 with cited mechanism, 1 pre-sprint). Acceptance #2 satisfied (≥1 HIGH).

## Recommended next action (per Phase 4 anti-rubber-stamp rules — HIGH-confidence path)

**Open a single chore(td-170c) PR with this sed-style sweep:**

```sh
# In e2e/, two literal replacements:
#   "Share update"                   → "Post to journal"
#   "Share how today went..."        → "What happened today? Even one line is enough."
# Apply to all .ts/.tsx files in e2e/. 11 files affected; 54 callsites total.

cd e2e
grep -rl "Share update" . | xargs sed -i '' 's/Share update/Post to journal/g'
grep -rl "Share how today went\.\.\." . | xargs \
  sed -i '' 's/Share how today went\.\.\./What happened today? Even one line is enough./g'
```

**Per-file callsite count (verified via `grep -rcE`):**

| File | Callsites |
|---|---:|
| e2e/roles.spec.ts | 18 |
| e2e/auth-journal.spec.ts | 7 |
| e2e/journal-write.spec.ts | 6 |
| e2e/journal.spec.ts | 5 |
| e2e/journal-detail.spec.ts | 4 |
| e2e/care-event-comments.spec.ts | 3 |
| e2e/flag-reactions.spec.ts | 3 |
| e2e/medication-tagging.spec.ts | 3 |
| e2e/navigation.spec.ts | 3 |
| e2e/dashboard-nav.spec.ts | 1 |
| e2e/onboarding.spec.ts | 1 |
| **Total** | **54** |

**Verification step:** push branch → wait for CI E2E → confirm all 3 shards green. If still red, a third drifted string from PR #529 exists — re-investigate using same procedure.

## Followup-row recommendation

- **TD-170c** (proposed) — `🟢 Ready · P1 / High · ~30 min` — execute the recommended sed sweep above + verify CI green. XS surface; should be solo direct-mode wave.
- **Optional bonus (TD-170d)** — once TD-170c lands, audit `e2e/**/*.spec.ts` for any `getByText`/`getByPlaceholder`/`getByRole({ name: ... })` whose target string was renamed in a UI PR since 2026-05-01 (post-redesign copy-audit window). One-shot grep + sweep would harden against the next instance of this same regression. Could be paired with adding an E2E-string-coverage lint rule.

## Process lesson

PR #529's description claimed "2 test files updated" — both were vitest, not E2E. The PR-author + reviewer didn't grep `e2e/` for the renamed strings. Recommend a CLAUDE.md addendum or pre-commit hook: **when a PR renames a UI string in `apps/web/**/*.tsx`, grep `e2e/` for the old string and require either an explicit update or an explicit "no E2E references" claim in the PR body.** Filed separately if user wants to action.

## Investigation accounting

- Phase 1 (read failure): ~10 min — confirmed `text=Share update` failure mode
- Phase 2 (narrow window): ~5 min — `git log -S "Share update"` immediately pointed at PR #529
- Phase 3 (cross-reference hypotheses): ~10 min — H5 + H8 confirmed HIGH; 5 others ruled out by single-mechanism evidence
- Phase 4 (rank + recommend): ~5 min — anti-rubber-stamp rules satisfied at HIGH tier
- Phase 5 (write report): in-progress as this file

Total investigation wall time: ~30 min (well under the 75-min plan estimate). The H5 evidence is so direct that the other hypotheses each took under a minute to rule out.
