# Plan: Live-test P1s — restore journal write path + transactional email

**Sprint slug:** `live-test-p1s-2026-05-17`
**Base:** `fc591b1` (post-PR #550)
**Drives:** TD-149, TD-150, TD-151
**Wave-target:** 3 tracks, file-disjoint, mostly parallel. Track 1 has a diagnostic phase that may inform Track 2; otherwise independent.

## Goal

Restore the two most basic user actions in production:
1. Sign in (TD-151 unblocks Gmail-bound OTP delivery)
2. Log a journal entry from the dashboard (TD-149 + TD-150 unblock the Quick log write path)

This is the broken→readable 20%. No polish; no new product surface.

## Constraints

- All work scoped to existing surfaces. No new endpoints, schemas, or UI panels.
- TD-149 starts read-only (investigation) — a code change lands only after the root cause is identified and the diagnosis is summarized in the PR description.
- TD-151 is operator-executed config (DNS + Resend dashboard) — the deliverable is a checklist + verification proof, not application code.
- PHI rule: any new logging / instrumentation added in TD-149 or TD-150 must use UUIDs only — no email/name/phone.

## Tracks

### Track 1 — TD-149: care_events HEAD 503

**Branch:** `fix/td-149-care-events-head-503`
**FILES ALLOWED:**
- `supabase/migrations/<timestamp>_td_149_<short_desc>.sql` (new — only if migration needed; filename pattern `<ts>_td_149_*.sql`)
- `supabase/tests/care_events_rls.test.sql` (additional pgTAP case for HEAD vs GET)
- `apps/web/app/(app)/dashboard/DashboardClient.tsx` (confirmed call site at line 166: `select("*", { count: "exact", head: true })`)
- `apps/web/lib/**` or `apps/web/server/**` (only the file that issues the failing HEAD, if it's not DashboardClient)
- `docs/research/2026-05-17-td-149-care-events-head-503.md` (new — investigation notes)
**FILES OUT OF SCOPE:** all other UI components, all unrelated routers, all other migrations.

**Phase A — Diagnose (read-only).**
1. Reproduce locally: sign in, open dashboard, capture the failing HEAD request via Playwright + DevTools Network or a `curl` repro against local Supabase.
2. Open Supabase dashboard → Database → Logs (Postgres) for the failure timestamp; capture the actual postgres error code + statement.
3. Read the current RLS policies on `care_events` (look at `supabase/migrations/20260327234330_core_schema.sql` and any subsequent migrations touching that table).
4. Run `EXPLAIN ANALYZE` against the **count-shape that PostgREST actually emits for `head:true`**: `SELECT count(*) FROM care_events WHERE org_id = '<test-org>'` (with the RLS quals expanded — capture both the raw query and the RLS-rewritten plan). RLS-eval cost on a `count(*)` is structurally different from a filtered row fetch, so do NOT proxy this with `SELECT 1`. Capture plan + timing.
5. Three hypotheses to confirm/reject:
   - **H1 (likely):** missing index causes RLS row-evaluation to scan the full table on HEAD; the bounded GET (`select=created_at order=created_at.asc limit=1`) hits a different path that doesn't scan.
   - **H2:** RLS policy contains a function call that errors when no `select` columns are specified.
   - **H3:** PostgREST HEAD + `select=*` semantics interact badly with RLS at scale; the unbounded variant should be replaced at the call-site.
6. Write findings to `docs/research/2026-05-17-td-149-care-events-head-503.md` (1 page max) — diagnosis + chosen-fix justification. Commit this BEFORE any code change.

**Phase B — Fix.** Path depends on Phase A:
- **If H1:** add migration `supabase/migrations/<ts>_td_149_care_events_org_id_created_at.sql` creating `CREATE INDEX` (plain, NOT `CONCURRENTLY`) on `(org_id, created_at)`. **Why plain:** Supabase migrations apply inside an implicit transaction; `CREATE INDEX CONCURRENTLY` is disallowed inside transaction blocks and would error at migration time. Every existing carelog migration uses plain `CREATE INDEX` (e.g. `20260327234330_core_schema.sql`) — match that pattern. If the table is large enough that the brief AccessShareLock from plain CREATE INDEX is unacceptable, the index must be created out-of-band by the operator via Supabase SQL Editor with `\set AUTOCOMMIT on`, and the migration becomes a noop that records intent only. Run `pnpm migration-check` before opening PR. Add a pgTAP case asserting the HEAD path returns count without 503.
- **If H2:** patch the offending RLS policy in a new migration; pgTAP case must cover the prior-error condition.
- **If H3:** replace the call-site HEAD with a bounded GET in `apps/web/lib/…`; add a unit test that asserts the new query shape.

**Acceptance:**
- Investigation note committed at `docs/research/2026-05-17-td-149-care-events-head-503.md` with EXPLAIN output and chosen hypothesis.
- HEAD-equivalent against `care_events` no longer 503s in repro (curl + Playwright).
- `supabase test db` green (new pgTAP case included).
- `cd apps/web && npx vitest run` green.
- PR description summarizes root cause in ≤3 sentences + links the research note.

### Track 2 — TD-150: Quick log navigation silent-failure

**Diagnosis refinement before scope contract:** `QuickLogFab.tsx:87-94` does NOT open a modal — it `router.push(/journal/${recipientId}?panel=...)` if `recipientId` is set, else `router.push("/dashboard")` (a no-op when already on dashboard). The live-test report's "modal silently fails to open" is almost certainly **the `recipientId` fallback firing for the new test user**: signup happens, but the dashboard's `activeRecipientId` isn't resolved, so every Quick log click pushes to `/dashboard` (current URL) → no visible state change. The destination route `/journal/[recipientId]` is where any "modal/panel" actually renders.

**Branch:** `fix/td-150-quick-log-modal`
**FILES ALLOWED:**
- `apps/web/components/QuickLogFab.tsx` (click handler, recipientId resolution)
- `apps/web/components/__tests__/QuickLogFab.test.tsx`
- `apps/web/components/__tests__/QuickLogFab.a11y.test.tsx`
- `apps/web/components/app/AppShellClient.tsx` (only the call site that passes `recipientId` to QuickLogFab — confirm via grep before editing; edit only if recipientId resolution is wrong there)
- `apps/web/app/(app)/journal/[recipientId]/page.tsx` and direct sibling client components (only if Phase A determines the bug is at the destination route, not the source)
**FILES OUT OF SCOPE:** `apps/web/components/CommandPalette.tsx`, `apps/web/components/ai/AIActionCard.tsx`, all RLS / migrations / server / unrelated route code.

**Subtlety:** Track 2 may dissolve if Track 1's fix surfaces a global "dashboard degraded" state that prevented `recipientId` from resolving. Track 2 starts only after Track 1 Phase A completes. If Phase A's investigation note states "TD-150 was downstream of TD-149", Track 2 is a confirmation-only PR (add a vitest reproducing the prior failure and confirming green post-fix; no production code change beyond pinning a test).

**Phase A — Reproduce + diagnose.**
1. Read `QuickLogFab.tsx` end-to-end (180 lines). Confirm the navigation hypothesis: when `recipientId` is null/undefined, click → `router.push("/dashboard")` (current URL).
2. **Reproduce in both states before committing to a theory:** (a) a new test user with zero recipients; (b) an existing test user with ≥1 recipient. The live-test report only saw scenario (a) — if scenario (b) ALSO silently fails, the bug isn't "no recipientId" but a deeper resolution race (hydration timing, stale slice) and Phase B's fix path changes accordingly.
3. Add a failing vitest: render QuickLogFab with `recipientId={undefined}`, click Log mood, assert the user is taken to a meaningful destination (not a no-op push to current dashboard). Expected to fail per the live-test report.
4. Determine root cause: is `recipientId` not being resolved during onboarding (the new user has zero recipients), or is it not being passed down through `AppShellClient.tsx`, or is it a hydration/state-timing race? Capture the answer in the PR description before writing the fix.

**Phase B — Fix.** Smallest correct change. Likely candidates:
- If new users have no recipients yet, the Quick log FAB should either be **disabled with helper text** ("Add a recipient first to start logging") OR navigate to `/onboarding/add-recipient`. **Do NOT** simply `return null` when `recipientId` is falsy — that creates a regression for existing users in the transitional loading state (FAB appears/disappears as `recipientId` hydrates). Distinguish three states: `loading` (FAB visible, disabled, no helper), `no recipient yet` (FAB visible, disabled, helper text), `recipient resolved` (FAB visible, enabled).
- If `recipientId` IS resolvable but not flowing through, fix the prop wiring.
- If the destination route `/journal/[recipientId]/?panel=...` renders nothing for valid recipientIds (separate bug), fix the panel-query-param dispatch.
- **Sentry instrumentation note:** if `Sentry` is NOT already imported into `QuickLogFab.tsx` (confirm via grep before editing), do **not** add a Sentry import here — defer the breadcrumb to TD-152's scope. The Track 2 fix must not create the first Sentry import in this component. If `Sentry` is already imported elsewhere in the file, add one breadcrumb at the FAB click entry as a down-payment.

**Acceptance:**
- Failing vitest from Phase A is green.
- A11y test (`QuickLogFab.a11y.test.tsx`) still green.
- Manual smoke (operator): a new test user with zero recipients clicks Log mood and lands on a meaningful screen (NOT a no-op return to dashboard).
- A real user with a recipient clicks Log mood and lands on `/journal/[recipientId]?panel=mood` (or wherever the panel renders) — confirm visually.
- `cd apps/web && npx vitest run` green; `pnpm exec eslint --quiet apps/web/components/QuickLogFab.tsx` green.

### Track 3 — TD-151: DMARC + sender hardening (operator-executed)

**Branch:** `chore/td-151-dmarc-record`
**FILES ALLOWED:**
- `docs/runbooks/td-151-dmarc-sender-hardening.md` (new — operator checklist)
- `docs/runbooks/post-sec-001-happy-path.md` (note that DMARC mitigation has shipped — only after the operator confirms records resolve)
**FILES OUT OF SCOPE:** all application code.

**Deliverable:** an interactive runbook + a one-paragraph addendum to the post-SEC-001 runbook. No code change ships in this PR. The PR exists to record the operator action + provide a re-test pointer for the next live test.

**Operator steps (recorded in the runbook):**
1. **DNS:** at the registrar/Cloudflare for `care-log.org`, add TXT record `_dmarc.care-log.org` value `v=DMARC1; p=none; rua=mailto:dmarc@care-log.org`. Start `p=none` (monitor mode) per RFC 7489.
2. **Verify propagation:** `dig +short TXT _dmarc.care-log.org` should return the record within 24h (typically <30 min on Cloudflare).
3. **Resend sender:** in Resend dashboard, confirm `care-log.org` domain shows SPF + DKIM + Return-Path all green. If they regressed during SEC-001 rotation, re-publish from the dashboard.
4. **Move From-address off `noreply@`:** in Supabase Auth → SMTP Settings, change Sender Email to `hello@care-log.org` (or `auth@care-log.org`). Sender name stays `CareSync`. Save. **⚠️ Behavior change:** this changes the From-address on every transactional email in production (auth OTPs, invites, future receipts). Operator must (a) confirm `hello@care-log.org` is a verified sender in Resend before the switch (else delivery breaks); (b) note that existing users will see a sender change — irreversible once users are conditioned. If not ready to commit to a permanent change, skip this step for this PR and seed a follow-up row.
5. **Re-test:** request OTP at https://care-log.org with a fresh throwaway gmail address. EXPECT: email arrives in Gmail inbox within 30s (not spam). If still missing, check Resend → Logs for delivery status.

**Acceptance:**
- Runbook committed at `docs/runbooks/td-151-dmarc-sender-hardening.md`.
- Operator attaches to the PR description: (a) `dig +short TXT _dmarc.care-log.org` output showing the DMARC record; (b) screenshot of the Resend delivery log entry for the test OTP (authoritative delivery signal — inbox presence is dependent on Gmail threading). Inbox screenshot is nice-to-have but not required.
- A new line at the top of `docs/runbooks/post-sec-001-happy-path.md` notes "DMARC mitigation shipped 2026-05-17 — re-test should now pass Phase 1 against Gmail".

## Merge order

Tracks 2 and 3 have no merge-time dependencies on Track 1. Execution gate is at branch-commit, not at merge:

1. **Track 1 Phase A** (investigation note **committed on the Track 1 branch**, no merge required) — informs whether Track 2 starts at all. As soon as the note is committed and visible on the Track 1 branch, Track 2 may start.
2. **Tracks 2 and 3 in parallel** — file-disjoint, no merge conflicts possible. PR-merge order between these two is irrelevant.
3. **Track 1 Phase B fix** — final PR. Auto-merge armed. May land before or after Tracks 2/3 since the diffs don't overlap.

**Cross-track staleness guard:** if Track 1 Phase B lands AFTER Tracks 2/3 are merged, the Track 2 vitest assertions about FAB behavior must be re-run against the post-Phase-B main (`cd apps/web && npx vitest run components/QuickLogFab`). The merge check is automated by CI, but a passing CI on Track 2's PR doesn't prove the test still asserts the right thing once Phase B lands — operator runs the targeted vitest on merged main once Phase B clears.

## Risks accepted

- **Track 1's fix path is contingent on diagnosis.** If Phase A reveals an unanticipated cause (e.g. Supabase regression outside our schema), the track may degrade to "open a Supabase support ticket" and the PR ships only the investigation note. That's still net value vs the current dark state.
- **Track 3's PR has no test signal** — it's documentation + operator action. The verification is operator-reported (dig output, inbox screenshot).
- **Track 2 may double-fix** if Track 1 was the root cause. The TD-152 Sentry down-payment in Track 2 stands regardless of whether the modal bug was downstream — instrumentation is still a positive change.

## Out of scope

- TD-152 full Sentry wiring (deferred to its own row; Track 2 adds a single breadcrumb only).
- TD-153 runbook reconciliation (separate row; this plan touches the post-SEC-001 runbook only with a one-line addendum).
- All TD-154..161 UX/follow-ups.
