# Wave F — Launch-prep loose ends

Closes the remaining launch-readiness rows that don't need product/legal
input: TD-03 Sentry source-map upload pipeline, PP-009 Android visual-QA
runbook, a Resend domain-verification runbook (capturing the only actionable
follow-up from the Wave D D2 contact-form fix), and a `chore(backlog)` sync
PR to flip the post-Wave-B/D status board.

Four file-disjoint tracks — designed to fan out via `/dispatch` ad-hoc.
Doc-heavy: F2 + F3 + F4 are doc/orchestration only; only F1 is a code change.

Base SHA at planning time: `09dd324`. All four parts branch off current
`origin/main` independently.

---

## Pre-flight (run in session before any dispatch)

1. `git fetch origin && git log origin/main --oneline -10` — confirm latest main.
2. Verify Wave D PRs (#254..#257) are queued — Wave F doesn't depend on them
   technically, but the `chore(backlog)` PR (F4) depends on them having
   landed before it can flip statuses. **Run F4 LAST** (or hold its dispatch
   until D1–D4 merge).
3. Check no in-flight PRs collide:
   `gh pr list --search "TD-03 OR PP-009 OR sentry OR observability" --state open`.
4. Print the base SHA each subagent will branch from = current `origin/main`.
5. Worktree layout:
   - `.worktrees/td-03-sentry-source-maps` → branch `feat/td-03-sentry-source-maps`
   - `.worktrees/pp-009-android-qa-runbook` → branch `docs/pp-009-android-qa-runbook`
   - `.worktrees/resend-domain-runbook` → branch `docs/resend-domain-runbook`
   - `.worktrees/backlog-sync-post-waveD` → branch `chore/backlog-sync-post-waveD`
6. Symlink `node_modules` per CLAUDE.md (root + apps/web) into each worktree.

---

## F1 — TD-03 · Sentry source-map upload pipeline

**Backlog row (§1):** "BUILD_STATUS: source maps pending `SENTRY_AUTH_TOKEN`.
Needs 🧑 env var in Vercel."

The env var is human-gated. **What this PR ships is the upload pipeline
itself**, so when the human adds the env var, source maps just start working.

### Investigation steps

1. `grep -rn "@sentry/nextjs\|sentry.client\|sentry.server\|withSentryConfig" apps/web` —
   find current Sentry config. Likely `next.config.ts` + a `sentry.client.config.ts`
   / `sentry.server.config.ts` pair.
2. Identify whether `withSentryConfig` is wrapped around the Next config and
   whether the source-map options are already enabled (just no token).
3. Check the build script in `package.json` / `apps/web/package.json` — does
   it run `next build` directly, or is there a custom step?

### Fix scope

- Wrap (or update) `withSentryConfig` in `apps/web/next.config.ts` with
  `widenClientFileUpload: true`, `hideSourceMaps: true`, and `org`/`project`/
  `authToken: process.env.SENTRY_AUTH_TOKEN` — the SDK no-ops gracefully when
  the token is absent (verify via the `@sentry/nextjs` docs before assuming).
- Add a build-time check: if `process.env.VERCEL === "1"` and
  `process.env.SENTRY_AUTH_TOKEN` is missing, emit a warning (not an error)
  to stderr — surfaces the silent-skip in CI logs.
- Add a 1-section append to `docs/project-info/runbooks/OBSERVABILITY.md`
  (created in Wave D / D4 / PR #255) under "Sentry — source maps", linking
  to this PR and documenting the human follow-up.

### Files allowed

- `apps/web/next.config.ts` (config wrap)
- `apps/web/sentry.client.config.ts` / `sentry.server.config.ts` (only if they
  exist and need the org/project keys)
- `apps/web/package.json` (only if a build script needs adjustment)
- `docs/project-info/runbooks/OBSERVABILITY.md` (append-only — DO NOT rewrite)

### Verify

1. `cd apps/web && npx tsc --noEmit` — clean.
2. `cd apps/web && pnpm build` — succeeds locally without `SENTRY_AUTH_TOKEN`,
   emits the expected warning, and produces `.next/static/...js.map` files
   even when the SDK can't upload.
3. `cd apps/web && npx vitest run` — full suite green.

### Owner / size

- **Owner:** Sonnet via Task tool — config-heavy with exact docs to follow.
- **Estimate:** ~1.5 hr.

---

## F2 — PP-009 · Android visual-QA runbook

**Backlog row (§3):** "Android: visual QA pass (screenshot every screen vs
iOS). `scripts/android-visual-qa.sh` written; run when Android emulator
available."

Execution is human-gated (needs an Android emulator). What ships here is the
runbook so the next human (or scheduled Android-emulator slot) has a
self-contained reference.

### Files allowed (only)

- `docs/project-info/runbooks/ANDROID_VISUAL_QA.md` (new)

### Runbook structure

1. **Prerequisites** — Android Studio, an AVD running API 34, Expo Dev
   Client built for Android (point at the existing build profile).
2. **Run the script** — `scripts/android-visual-qa.sh` invocation, expected
   output dir, screenshot naming convention.
3. **Diff against iOS** — where the iOS reference screenshots live (or
   "TBD: capture iOS reference set first" if they don't exist yet — check
   `scripts/` and `docs/project-info/screenshots/` before claiming).
4. **What to flag** — typography drift, spacing differences, missing
   icons, contrast regressions, native-Android-only platform deviations
   that ARE expected (BackHandler, keyboard avoidance, status bar).
5. **Filing follow-ups** — convention for new TD/A11Y rows captured during
   the QA pass, which `chore(backlog)` PR they go into.

### Owner / size

- **Owner:** Haiku via Task tool — pure documentation, narrow surface.
- **Estimate:** ~45 min.

---

## F3 — Resend domain-verification runbook

Captures the actionable half of the Wave D / D2 follow-ups (the inactionable
half — `RESEND_API_KEY` already in Vercel — needed no work). Documents how
to verify the `care-log.org` sender domain in Resend so the new confirmation
email from PR #257 reliably delivers to inboxes (not spam).

### Files allowed (only)

- `docs/project-info/runbooks/RESEND_DOMAIN_VERIFICATION.md` (new)

### Runbook structure

1. **Why** — confirmation emails (#257) and internal notifications both
   ship from `noreply@care-log.org`; unverified domains land in spam.
2. **Verify the domain in Resend dashboard** — exact navigation path,
   what each DNS record (SPF, DKIM, DMARC) does, where to add them in
   the DNS provider for `care-log.org`.
3. **DKIM key rotation policy** — when (annually) and how (via Resend
   dashboard, propagate to DNS, verify with `dig`).
4. **Spam-folder checks** — where to test deliverability (Mail-Tester or
   GlockApps), what score we want (≥9/10).
5. **Cross-link** to `OBSERVABILITY.md` § alerts for "if confirmation
   email delivery rate drops, page on-call."

### Owner / size

- **Owner:** Haiku via Task tool — doc-only.
- **Estimate:** ~30 min.

---

## F4 — `chore(backlog): sync post-Wave-B/D status board`

Reconciles `BACKLOG.md` against git log + open PRs after Wave B + Wave D
land. **MUST run on its own dedicated branch** per CLAUDE.md; never bundled
with feature work.

### Files allowed (only)

- `BACKLOG.md`

### Steps

1. Run `/backlog-sync` in the worktree. The skill rewrites §0 status board
   counts and promotes shipped rows to §7.
2. Verify the resulting diff: every Wave B PR (#247/248/249/250) and every
   Wave D PR (#254..#257) appears in §7 with the correct PR number.
3. Verify §0 counts match `gh pr list --state merged --search ...` output.

### Important

- This PR runs LAST. If F1/F2/F3 are still open when F4 wants to dispatch,
  hold F4 — its diff would conflict with their post-merge sync. Better to
  dispatch F1/F2/F3 in parallel, wait for them to merge, then run F4.
- DO NOT bundle any new TD-* / A11Y-* / UX-* rows into this sync PR. New
  rows go into a separate `chore(backlog): add TD-XX..YY` PR.

### Owner / size

- **Owner:** Opus orchestrator runs `/backlog-sync` directly. No subagent.
- **Estimate:** ~10 min orchestration.

---

## Wave F — Subagent scope contract template

```
FILES ALLOWED: <list from F1/F2/F3/F4 above>
BRANCH: <feat/td-03-... | docs/pp-009-... | docs/resend-... | chore/backlog-sync-...>
DO NOT: bundle code changes into doc PRs (F2/F3), bundle new backlog rows
        into the sync PR (F4), modify BACKLOG.md from F1/F2/F3, capture
        PII in any new analytics
PHI RULE: posthog.identify() / posthog.capture() must use UUID only — never
          email, name, or any PII (does not directly apply — none touch
          analytics — kept for policy)
VERIFY:
  - F1: cd apps/web && pnpm build (succeeds without SENTRY_AUTH_TOKEN, emits
        warning) + tsc + vitest
  - F2 / F3: prose review only; render markdown locally; verify links resolve
  - F4: diff is BACKLOG.md only; §0 counts match `gh pr list` output
HEARTBEAT: append timestamp every ~5 min to .claude/agent-status/<id>.log
```

---

## Wave F — execution mode

- **`/dispatch`** in ad-hoc mode for F1/F2/F3 (3 disjoint tracks, fan out).
- F4 is a **direct Opus orchestration** — invoke the `/backlog-sync` skill
  in this session after F1/F2/F3 merge.
- F1 uses plain implementation (config + tests, but small surface — TDD
  overhead exceeds value).
- F2, F3 are docs — no TDD.
- Per PR: local green → `gh pr create` → `gh pr edit <num> --add-label queue` →
  15-min wakeup.

## Wave F — risks

- **F1 build regression.** Wrapping `withSentryConfig` can break the build
  on subtle SDK-version mismatches. Verify `pnpm build` locally BEFORE
  pushing, not just `tsc`. If the build breaks, escalate — don't ship the
  config change without a working build.
- **F2 references missing iOS screenshots.** If no iOS reference screenshots
  exist anywhere in `docs/project-info/screenshots/` or `scripts/`, write
  the runbook with a "TBD: capture iOS reference set first" placeholder
  rather than inventing a path. Open a follow-up TD row.
- **F3 Mail-Tester score < 9.** If the runbook author runs the Mail-Tester
  step and the score is below 9, that's a real deliverability gap — capture
  the score in the runbook AND open a `🧑 Needs human` row in a follow-up
  backlog PR. Do not silently document a passing score that doesn't exist.
- **F4 race with sibling PRs.** If F1/F2/F3 are still open when F4 dispatches,
  the sync PR's BACKLOG.md diff will conflict on rebase. Default rule per
  CLAUDE.md: `git checkout --theirs BACKLOG.md && git add BACKLOG.md` and
  let `/backlog-sync` rewrite it on the next run. But the safer path is
  simply to delay F4 until F1/F2/F3 merge.

---

## Cross-wave invariants

- **No `BACKLOG.md` edits in F1/F2/F3.** Only F4 touches it.
- **Independent base SHAs.** All four branches off current `origin/main`.
- **No file overlap.** F1 owns next.config.ts + (optionally) the sentry config
  pair + a small append to OBSERVABILITY.md. F2 owns one new runbook. F3
  owns one new runbook. F4 owns BACKLOG.md only.
- **Mergify queue label by default** on every PR; 15-min wakeup.

## Suggested running order

- **F1, F2, F3 in parallel** via `/dispatch` (truly disjoint).
- **F4 last** — wait for F1/F2/F3 to merge, then run `/backlog-sync` and
  open the chore PR. Otherwise the BACKLOG.md diff fights the sibling
  status flips.
