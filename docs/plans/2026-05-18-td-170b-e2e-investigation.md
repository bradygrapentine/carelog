# TD-170b — Root-cause E2E chronic-red on main (investigation plan)

**Date:** 2026-05-18
**Source backlog:** TD-170b (🟢 Ready · P1 / High)
**Sprint slug:** td-170b-e2e-investigation
**Base SHA:** bfefc23 (post-#604 merge)
**Execution mode:** direct (single track, doc-only investigation)
**Scope:** read-only — produces a hypothesis ranking with file:line evidence and a recommended next action. **NO production code change in this PR.** Actual fix is a follow-up sprint.

## Why this matters

Main CI has been red on E2E for 15+ consecutive runs. PR #592 (TD-170) shipped a 2-line selector helper fix on 2026-05-17 expecting to restore green; CI history shows it did not. Auto-merge fires on required checks (lint/typecheck/web-unit/RLS); E2E is silently bypassed. **Any behavioral regression that ships during this window is invisible until it hits production.** The Lighthouse a11y gate restored in TD-87 protects accessibility surface; E2E protects everything else. Without it the merge-time safety net is half-functional.

## Known boundaries

- **Last known-green CI run on main:** `05ad945` @ 2026-05-15T20:40Z (3 days ago)
- **Current HEAD:** `bfefc23` (post-#604)
- **Regression window:** commits between `05ad945..bfefc23` (3-day, ~10+ merged PRs)
- **PR #592 fix:** merged 2026-05-17 — did NOT restore green. Either its hypothesis was wrong, OR there's a second regression layered on top.

## Pre-seeded hypotheses (from TD-170b row + TD-170 row notes)

To confirm/rule-out by evidence in the report:

1. ~~**Supabase JWT-mint env drift from SEC-001**~~ — **PRE-RULED-OUT before sprint start.** `ci.yml:270–296` mints a local HS256 JWT deterministically from the hardcoded `super-secret-jwt-token-…` literal and runs E2E against `localhost:54321` (Supabase CLI), not prod. The SEC-001 2026-05-16 rotation of `sb_secret_*` cannot mechanically affect this job — the comment at `ci.yml:281` says "Decoupled from CLI version forever." **This hypothesis must NOT be the recommended next action.** Carried in the report only as "checked + ruled out + cited mechanism" so future investigators don't re-seed it.
2. **Playwright selector brittleness on Next 16 streaming** — UI shipped in 2026-05-15..18 window may have changed the auth-success route's render timing such that `page.waitForURL` times out before the route resolves.
3. **Vercel preview env race vs. locally-served build** — the E2E job runs against a locally-built `pnpm start`. Investigate whether `pnpm --filter web build` resolves any env vars from outside the in-step `$GITHUB_ENV` (e.g. a `.env` file checked in, or a Vercel-pull at install time) that would diverge from what `pnpm start` sees.
4. **`SignInForm` calls `supabase.auth.signInWithOtp` client-direct** (per TD-155 note) — if Supabase Auth's own send-rate limiter is hitting from CI's shared egress IP (separate from carelog Upstash middleware), every E2E sign-in 429s and never produces a URL change → `waitForURL` timeout. Note: E2E runs against local CLI Supabase, not prod — this only fires if local CLI also rate-limits, which it usually doesn't. Lower confidence than initially weighted.
5. **PR #528 (UX-049) selector drift, layer 2** — TD-170 fixed one selector (`/Verify code/`); there may be a sibling selector elsewhere in the auth-gated E2E suite that also drifted but wasn't covered by PR #592.
6. **Next.js 16 + middleware cookie-domain mismatch** — Next 16 proxy.ts cookie API + Playwright browser-context cookies not persisting across redirects.
7. **(new) PR #592's fix deployed but E2E ran stale artifacts.** Possible mechanisms: shard-runner Playwright browser binary cache stale post-Next-16; node_modules pnpm-store cache hit on a pre-fix shape; CI build artifact reuse. If the helper-fix landed in source but the job re-used a pre-fix bundle, the failure would persist post-merge.
8. **(new) PR #592's fix is correct but insufficient** — the helper fix addresses ONE selector; if ≥2 selectors drifted simultaneously in PR #528, the second is still broken. Phase 3 H5 grep covers this directly; H8 differs in that it predicts a SPECIFIC pattern (multiple-selector drift from one UI PR) the grep should confirm.

## Investigation procedure

Per global CLAUDE.md "Diagnose Before Dispatching" — **read the actual failure FIRST**, then narrow the commit window from evidence rather than enumerating speculatively.

### Phase 1 — Read the actual failure (15 min)

1. `gh run list --branch main --workflow=CI --status failure --limit 1 --json databaseId --jq '.[0].databaseId'` — get a recent fully-failed run ID (not in-flight).
2. For each E2E shard `[1/3]`, `[2/3]`, `[3/3]`: `gh run view <id> --job <job-id> --log-failed | head -100`. Capture: the spec name(s), the failing assertion, the URL state at timeout, console errors (if any).
3. Compare against `05ad945`'s known-green log for the same shard name(s): `gh run view <known-green-run-id> --job <same-job-name> --log | grep -E "passing|failing|page\.waitForURL"`.
4. Note: same specs failing across all 3 shards = systemic; one spec failing in one shard = flaky/specific. Same spec name surviving (passing) in green and dying (timing out) in red = behavior regression on that spec's surface.

### Phase 2 — Narrow the regression window driven by Phase 1 evidence (15 min)

Given the failing spec(s) and assertion(s) identified in Phase 1:

1. `git log --oneline 05ad945..bfefc23 -- <files touched by the failing spec(s) + their adjacent UI surfaces>` — enumerate only commits that could plausibly affect the identified failure mode (don't enumerate all 10+ window PRs).
2. For each commit/PR in the narrowed list, note: PR number, title, files touched. Build a focused suspect table sized to the failure.
3. If Phase 1's failure mode points at a non-code cause (cache, env, infra), Phase 2 may emit "no commits implicated — failure is environmental" instead.

### Phase 3 — Cross-reference against hypotheses (30 min)

For each pre-seeded hypothesis, attempt to confirm/deny with evidence:

- ~~H1 (JWT env drift)~~ — PRE-RULED-OUT above; report cites `ci.yml:270–296` mechanism and moves on. Do NOT spend investigation time here.
- H2 (Playwright timing): read 1–2 failing E2E specs, identify the `waitForURL` call; check `git log apps/web/proxy.ts apps/web/middleware*` in the window for Next 16 redirect-timing changes.
- H3 (env race): read `pnpm --filter web build`'s env-var resolution. Check (a) any `.env*` files committed in `apps/web/`, (b) whether install/build hits any external secret source (Vercel CLI, GitHub OIDC), (c) compare what's in `$GITHUB_ENV` at build-time vs. start-time in the E2E job.
- H4 (rate-limit 429): **skip if no Supabase dashboard / log access OR if Phase 1 evidence shows the failure happens BEFORE any sign-in attempt**. Otherwise: check `supabase/migrations/` for rate-limit config drift in the window.
- H5 (additional selector drift): `grep -rn "getByRole({ name:\\|getByText" e2e/` then cross-reference each name string against UI strings touched in PRs from the 2026-05-15..18 window.
- H6 (Next 16 cookie domain): `git log --oneline 05ad945..bfefc23 -- apps/web/proxy.ts apps/web/middleware*`; read Next 16 upgrade notes if any commit touches these.
- H7 (stale artifacts): check `ci.yml` for `actions/cache` keys covering `node_modules` / `~/.cache/ms-playwright`; verify cache key includes PR #592's commit SHA or lockfile hash so a content change invalidates. If cache key is stable across the regression window, H7 advances.
- H8 (PR #592 fix insufficient): combine with H5 — if grep surfaces ≥2 selectors that match UI strings drifted in PR #528, H8 confirms.

### Phase 4 — Rank + recommend (15 min)

Rank hypotheses by evidence strength:
- **HIGH confidence** — direct file:line evidence + log correlation
- **MEDIUM confidence** — plausible mechanism + circumstantial evidence
- **LOW confidence** — pre-seeded but no evidence either way (mark for follow-up investigation)
- **RULED OUT** — evidence directly contradicts

**Recommended-next-action rules (anti-rubber-stamp):**

- If at least one hypothesis reaches HIGH → recommend a specific code patch with file + line + change shape.
- If top rank is MEDIUM only → recommend a deeper-instrumentation step (download Playwright traces from a failed run, dump `$GITHUB_ENV` at build-time, etc.) — NOT a code patch. Code patches off MEDIUM evidence are how regressions get layered on top of regressions.
- If top rank is LOW only → recommend "escalate to root-cause-by-bisect" (cherry-pick suspect PRs onto `05ad945` one at a time in a throwaway branch, push, observe E2E) — and stop the sprint.
- If everything is RULED OUT → recommend re-scoping (the regression is in a category not in the pre-seed list; document the gap and re-open as TD-170c with the additional hypotheses surfaced).

### Phase 5 — Write the report

`docs/notes/2026-05-18-td-170b-e2e-investigation.md` — sections:

- Summary (3 sentences max)
- Regression window + boundary commits
- Failed run characteristics (specs, shards, failure mode)
- Hypothesis ranking with confidence + evidence + file:line cites
- Recommended next action (1 sentence)
- Followup-row recommendation (whether the fix warrants its own backlog row, and at what priority)

## Acceptance

1. Report exists at `docs/notes/2026-05-18-td-170b-e2e-investigation.md`, ≤300 lines.
2. **All 7 active pre-seeded hypotheses (H2–H8; H1 is pre-ruled-out at plan time)** have confidence labels backed by file:line evidence or explicit "no evidence found despite checking X, Y, Z" notes. To prevent gaming, the report must reach **EITHER (a) at least one HIGH-confidence hypothesis, OR (b) at least two RULED-OUT hypotheses with cited mechanism** before "no evidence found" labels count toward the 7. A single trivial RULED-OUT + six no-evidence-found does NOT satisfy.
3. Report names a specific recommended next action per the Phase 4 anti-rubber-stamp rules: HIGH → code patch with file+line; MEDIUM → instrumentation step; LOW → bisect escalation; all-RULED-OUT → re-scope to TD-170c with new hypotheses. "Investigate further" alone fails this bar.
4. Report cites at least one failed-CI-run URL and one known-green-CI-run URL.
5. No production code or test code touched in this PR. Only the report + plan + SPRINT_STATE.md.

## Out of scope (file-and-watch)

- **Actual fix.** The fix is a follow-up sprint after this investigation lands. The report's "Recommended next action" feeds /implementation-plan for the fix sprint.
- **Re-running E2E locally.** Investigation reads CI logs only; running E2E locally takes too long and the cause might be CI-specific (egress IP, env-var shape).
- **Modifying Supabase Auth dashboard config** to test H4 — that's a manual operator step if H4 ranks HIGH.
- **Other red workflows** (Mobile/Trivy/etc) — those are green per recent runs; out of scope.

## Risks accepted

- **Hypothesis space may be wrong** — if all 6 pre-seeded hypotheses get ruled out and no new evidence surfaces, the report still ships with that honest conclusion + a recommendation to escalate (deeper Playwright trace inspection, contact the Next.js 16 upgrade owner, etc.).
- **CI may go green on its own** during the investigation (rare but possible if the cause is upstream-flaky). Investigation still ships — documents the historical regression for future debugging.

## /oop dimensions to watch (post-merge)

Doc-only sprint shipping a report. /oop --from-sprint will likely be a no-op or skip — the only file shipped is a markdown report. Sprint protocol still mandates the call; expect "no production module to evaluate" outcome.

## Merge order

Single PR. Auto-merge armed at open.

## Post-merge

- /oop --from-sprint (expect no-op or skip — doc-only)
- /housekeeping-wave to seed follow-up row if recommended action warrants
- /backlog-sync — TD-170b stays 🟢 Ready or flips to "Investigated 2026-05-18; awaiting fix" status; new TD-170c row for the actual fix if recommended.
