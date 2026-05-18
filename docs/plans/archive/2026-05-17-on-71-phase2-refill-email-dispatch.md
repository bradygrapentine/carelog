# ON-71 Phase 2 — Refill alert email dispatch + TD-176 Sentry tag convention

**Date:** 2026-05-17
**Base SHA:** `6d562a0d9568cf24f77f70faa5da73c76cc60cee`
**Source backlog:** ON-71, TD-176
**Threat model:** `docs/plans/2026-05-17-on-71-phase2-threat-model.md` (Critical: 1 | High: 4 | Medium: 6 | Low: 3 — all C+H+M selected per Gate 3b)
**Recommended executor:** `/sprint` (in-flight; this plan feeds Gate 2)

## Context

ON-71 Phase 1 shipped 2026-04 in commit `da3cbb9 feat(p3-04): refill alert — daily cron detects low supply, idempotent care_event`. The Inngest cron runs daily at 7am UTC, detects `medications.supply_days_remaining ≤ 7`, and inserts an idempotent `care_events` audit row. **It does not notify anyone.** This plan ships Phase 2 — the email dispatch.

## Goal

When the refill alert cron detects low-supply medications, send a single batched email per (org, recipient) per week to all active coordinators + recipient-scoped/org-wide caregivers, with pharmacy contact pre-populated. Idempotent (write-before-send via new `email_dispatch_log` table). PHI-clean (no email body / drug names / recipient addresses in Sentry).

## Non-goals

- **No notification opt-out preference** (M3) → file ON-71c as follow-up; include `List-Unsubscribe` header in this PR anyway as defense-in-depth.
- **No bounce / soft-fail handling** beyond Resend's response → file ON-71d follow-up if needed.
- **No in-app notification (push/Inngest fanout)** — email only this phase. UI consumption of the existing care_event row is separate.
- **No retroactive email send** for medications already flagged in care_events. Email dispatch starts from the next cron tick.
- **No HTML email** — plain text only. Closes XSS surface entirely (H4).
- **No change to Phase 1's audit-trail care_event insert** — that path stays exactly as-is. Email is additive.

## Tracks

### Track 1 — ON-71 Phase 2: refill alert email dispatch (with full security controls)

**Sources backlog ON-71 (Phase 2).** Owns the full security control set from the threat model.

**FILES ALLOWED** (modify/create):

- `apps/web/inngest/functions/refillAlert.ts` — extend to dispatch emails after care_event insert
- `apps/web/inngest/functions/__tests__/refillAlert.test.ts` — extend existing OR create new (single file — do NOT split)
- `apps/web/server/repositories/membershipsRepository.ts` — **add new `getRefillRecipients(orgId, recipientId)` helper** (pre-grep verified during planning: no existing function covers "coordinators + recipient-scoped/org-wide caregivers WITH resolved emails"; `getCareTeamForRecipient` returns names/roles only, no emails; `getMemberships` is generic). New helper mirrors `getCareTeamForRecipient`'s `CARE_TEAM_CHUNK_SIZE=8` rate-limit pattern but resolves `auth.admin.getUserById` for emails instead of `display_name`.
- `supabase/migrations/<next-id>_email_dispatch_log.sql` — new table for write-before-send idempotency (M1/M5)
- `supabase/tests/email_dispatch_log_rls.test.sql` — pgTAP for the new table
- `apps/web/lib/database.types.ts` — regenerated via `npx supabase gen types typescript --local 2>/dev/null` (mechanical regen; per CLAUDE.md `## Known Gotchas`)

**FILES OUT OF SCOPE — DO NOT TOUCH:**

- `apps/web/inngest/functions/weeklyDigest.ts` — share pattern by reading, do not modify
- `apps/web/server/resend.server.ts` — use the existing client export
- Any other Inngest function or router
- `BACKLOG.md` — feature PR doesn't touch backlog per ADR-0002

**Branch:** `feat/on-71-refill-email-dispatch` off base SHA above.

**Security controls (C1 + H1–H4 + M1/M2/M5 — required):**

1. **C1 — `org_id` filter mandatory on every membership lookup.** Service-role bypasses RLS. The new `getRefillRecipients` (or inline query) MUST chain `.eq("org_id", orgId)` on EVERY query. Acceptance: explicit grep verifies no membership reads without `org_id` filter.
2. **H1 — Active-member filter.** Schema-verified: `memberships` has no revocation column; removal = DELETE. So `accepted_at IS NOT NULL` + row existence IS correct. Acceptance: helper function header comment cites this finding; pgTAP test covers a removed-coordinator who is NOT included in the recipient list.
3. **H2 — Batching per (org, recipient).** Each (org, recipient) tuple gets at most ONE email per cron run regardless of how many medications are low. Email body iterates the medication list within. Acceptance: vitest case with 5 low-supply meds for 1 recipient × 3 coordinators expects exactly 3 emails dispatched (not 15).
4. **H3 — CRLF protection on pharmacy fields in headers.** Pharmacy data NEVER appears in email `subject`, `from`, or any header — only in the BODY. Acceptance: grep confirms `medication.pharmacy` is referenced ONLY inside the `text` body field of `resend.emails.send`, never in `subject`/`from`/headers.
5. **H4 — XSS prevention.** Plain text email only (no `html` field). All medication data + pharmacy data flows through plain text concatenation. No template literal injection into HTML. Acceptance: `resend.emails.send({ text: ..., html: undefined })` — no `html` key passed.
6. **M1/M5 — Idempotency via write-before-send table + pending-row sweep.** New table `email_dispatch_log (id uuid pk, org_id uuid, recipient_id uuid, kind text, dedup_key text, sent_at timestamptz, created_at timestamptz default now())`. **Composite unique constraint on `(kind, dedup_key)`** (NOT partial; non-partial composite already permits reuse across kinds — corrects nit from review). RLS: `ALTER TABLE email_dispatch_log ENABLE ROW LEVEL SECURITY;` with NO policies (default-deny under RLS-enabled — anon and authenticated cannot SELECT/INSERT/UPDATE/DELETE; service-role bypasses RLS as designed). Flow:
   - (a) **Pending-row sweep at top of cron** (closes step-boundary-failure gap MF1): `DELETE FROM email_dispatch_log WHERE sent_at IS NULL AND created_at < now() - interval '15 minutes' AND kind = 'refill'`. Pending rows from a crashed/timed-out prior step are cleared, freeing the dedup slot for retry. 15 min is generous vs an Inngest step's max wallclock; tune later if needed.
   - (b) Compute `dedup_key = "refill:" || org_id || ":" || recipient_id || ":" || iso_week` where `iso_week` is `YYYY-Www` (e.g. `2026-W21`).
   - (c) INSERT row with `sent_at = NULL`. On unique violation (Postgres `23505`), SKIP — either already sent (sent_at not null) or another in-flight worker holds the slot. Log "already dispatched or in-flight".
   - (d) On insert success, build email body + call `resend.emails.send`.
   - (e) On Resend success: `UPDATE email_dispatch_log SET sent_at = now() WHERE id = <inserted_id>`. The row is now permanent; no future retry will re-send.
   - (f) On Resend failure: leave row with `sent_at IS NULL`; re-throw so Inngest retries. Next retry runs the (a) sweep again, which will clear the pending row only if 15 min has passed. Within-window retries see the unique-violation and skip — acceptable single-failure miss (1 email per affected (org, recipient) per week).
   - Acceptance: pgTAP asserts (i) unique violation on duplicate `(kind, dedup_key)`, (ii) anon and authenticated roles cannot SELECT (default-deny), (iii) service-role can SELECT/INSERT/UPDATE; vitest asserts (iv) only first call sends, second is no-op, (v) pending row >15min old is cleared by the sweep step.
7. **M2 — Sentry capture excludes PHI.** On Resend dispatch error, `Sentry.captureException(err, { tags: { component: "refillAlert", path: "resend.error" } })` — NO `extra` with email body, drug name, or `to` address. Generic logger.info also excludes PHI. Acceptance:
    - `grep -nE "Sentry\\.(captureException|setUser|setContext)" apps/web/inngest/functions/refillAlert.ts | grep -iE "\\bto\\b|drug_name|pharmacy|body|html|text|email|\\binput\\b|\\bpatch\\b|\\.\\.\\." ` → empty
    - Mandatory unit test: mocked Resend rejection — captured Sentry payload (stringified) must NOT contain the literal drug name fixture (`"DRUG-NAME-SENTINEL"`) or recipient email (`"sentinel@example.invalid"`).
8. **M3 (deferred, defense-in-depth)** — include `List-Unsubscribe: <mailto:support@care-log.org?subject=unsubscribe-refill>` header in the dispatch. File **ON-71c** in a future chore-backlog PR for first-class opt-out.

**Implementation steps:**

1. Read `apps/web/inngest/functions/weeklyDigest.ts` for the established Resend dispatch pattern (`resend.emails.send`, error handling, no-op when `resend` client is null).
2. Read `apps/web/server/repositories/membershipsRepository.ts:60-119` for the existing `getCareTeamForRecipient` pattern; `getRefillRecipients` mirrors it but filters to `role IN ('coordinator', 'caregiver', 'aide')` AND scopes caregivers to either matching `recipient_id` OR `recipient_id IS NULL` (org-wide). Resolves email via `auth.admin.getUserById` per the chunked pattern.
3. Write the migration: `email_dispatch_log` table with columns `(id uuid default gen_random_uuid() pk, org_id uuid not null, recipient_id uuid, kind text not null, dedup_key text not null, sent_at timestamptz, created_at timestamptz not null default now())`. **Composite UNIQUE constraint on `(kind, dedup_key)`** (NOT a partial index — composite already permits the same `dedup_key` value across different `kind`s). Then explicitly: `ALTER TABLE email_dispatch_log ENABLE ROW LEVEL SECURITY;` with NO policies (default-deny under RLS-enabled; service-role bypasses as designed; anon + authenticated cannot SELECT/INSERT/UPDATE/DELETE). Run `supabase migration up` locally.
4. Write the pgTAP test: `supabase/tests/email_dispatch_log_rls.test.sql` — assert unique violation on duplicate insert, assert anon/authenticated roles cannot SELECT.
5. Regenerate `apps/web/lib/database.types.ts` (per CLAUDE.md gotcha — use `2>/dev/null`).
6. Extend `refillAlert.ts`:
   - After Phase 1's `care_events` insert per medication, group low-supply medications by `(org_id, recipient_id)` into a Map.
   - For each (org, recipient) group: compute `dedup_key = "refill:<org_id>:<recipient_id>:<iso_week>"` where `iso_week` is `YYYY-Www` (e.g. `2026-W21`). Use `step.run('dispatch-<org>-<recipient>', ...)` for retry-safe step boundary.
   - Within the step: INSERT into `email_dispatch_log` with the dedup_key. On unique violation (Postgres code `23505`), log "already dispatched this week — skipping" and return early.
   - On insert success: fetch refill recipients via `getRefillRecipients(org_id, recipient_id)`, build the plain-text email body iterating the medication list (drug name, days remaining, pharmacy name, pharmacy phone), call `resend.emails.send({ to: [...emails], subject: "Refill reminder for your care recipient", text: body, html: undefined, headers: { "List-Unsubscribe": "<mailto:support@care-log.org?subject=unsubscribe-refill>" } })`.
   - On Resend success: UPDATE `email_dispatch_log SET sent_at = now()` for the row.
   - On Resend failure: PHI-clean Sentry capture (no body/drug/to leakage). Re-throw so Inngest retries — the dedup row stays so next retry skips re-sending; this is the documented trade-off (one failed send = no email, vs duplicate). Document in code.
7. Tests:
   - **Existing Phase 1 tests still green** (regression guard).
   - New cases:
     - `detectLowSupply` is unchanged (sanity).
     - Batching test: 5 meds for 1 recipient + 3 coordinator memberships → 1 Resend call with `to: [3 emails]`, body lists 5 meds.
     - Idempotency test: 2 invocations same week → 1 Resend call total. Second invocation observes the unique violation, no Resend call.
     - PHI sentinel test (M2): mock Resend rejection, assert Sentry capture excludes `"DRUG-NAME-SENTINEL"` and `"sentinel@example.invalid"`.
     - `getRefillRecipients` test (**vitest, NOT pgTAP** — uses mocked `auth.admin.getUserById` per the chunked-resolution pattern; pgTAP can't exercise the JS admin client): removed caregiver (DELETE'd membership) is NOT in the result; recipient-scoped caregiver IS; unrelated-recipient caregiver is NOT.
     - Cross-org test (**vitest**): caregiver in DIFFERENT org with same recipient_id (impossible by FK but defensive) is NOT in result — verifies `org_id` filter (C1).
     - Header injection test: pharmacy_phone with `\r\nBcc: attacker@evil.com` does NOT appear in any Resend call's `subject`/`from`/header field (only in plain `text` body, where Resend escapes appropriately).

**Acceptance (verifiable):**

- `cd apps/web && npx vitest run inngest/functions/__tests__/refillAlert` — all green (existing + new)
- `cd apps/web && npx tsc --noEmit` — clean
- `cd apps/web && npx eslint --quiet inngest/functions/refillAlert.ts server/repositories/membershipsRepository.ts` — clean
- `pnpm migration-check` — drift-free
- `supabase test db` (RLS pgTAP) — new email_dispatch_log RLS test passes
- PHI grep #1 (field names): `grep -nE "Sentry\\.(captureException|setUser|setContext)" apps/web/inngest/functions/refillAlert.ts | grep -iE "drug_name|pharmacy|body|html|text|email|to:|recipient.*email"` → empty
- PHI grep #2 (spreads): `grep -nE "Sentry\\.(captureException|setUser|setContext)" apps/web/inngest/functions/refillAlert.ts | grep -iE "\\binput\\b|\\bpatch\\b|\\bctx\\.input\\b|\\.\\.\\."` → empty
- Sentinel test in vitest passes (PHI not in mocked Sentry payload)
- Plain-text-only grep: `grep -nE "html:" apps/web/inngest/functions/refillAlert.ts` → empty (no HTML field passed to Resend)
- Batching grep: `step.run('dispatch-` appears, with batching by (org_id, recipient_id) tuple verified by the corresponding vitest case
- Pre-commit + CI green on PR
- Manual smoke on localhost: trigger via `npx inngest-cli@latest dev` → "Send Event" for the cron, observe single email per recipient with all 5 meds listed in body

**Risk + mitigations:**

- Risk: Inngest retry duplicate email despite the dedup table — mitigated by INSERT-before-send order + unique constraint.
- Risk: One coordinator + caregiver share an auth.users row → email sent once due to set dedup, OR sent twice due to separate addresses. Acceptance: build `to` as a Set of resolved emails before passing to Resend.
- Risk: `auth.admin.getUserById` rate limit (50/s) on large teams — mitigated by reusing the `CARE_TEAM_CHUNK_SIZE = 8` chunking pattern from existing `getCareTeamForRecipient`.

### Track 2 — TD-176: Sentry `component` tag convention

**Sources backlog TD-176.** Pure docs + scoped sweep.

**FILES ALLOWED** (modify/create):

- `docs/project-info/technology/CODE_STANDARDS.md` — add a §Sentry tag convention section
- `apps/web/app/api/ocr/confirm/route.ts` — **pre-grep confirmed: exactly 2 sites** at lines 105 + 121, both `component: "ocr.confirm"` → `"api.ocr.confirm"`. No other API-route Sentry tag sites in the codebase use the `<resource>.<verb>` shorthand. Sweep is bounded at 2 lines in 1 file.

**FILES OUT OF SCOPE — DO NOT TOUCH:**

- tRPC routers (use the established `<router>.<method>` convention — do NOT rename)
- Track 1's files (`refillAlert.ts` will use `component: "inngest.refillAlert"` per Track 1; Track 2 doesn't change that)

**Branch:** `chore/td-176-sentry-tag-convention` off base SHA above.

**Implementation steps:**

1. Add §Sentry tag convention to `CODE_STANDARDS.md`:
   - tRPC procedures: `component: "<routerName>.<procedureName>"` (e.g. `"memberships.invite"`)
   - API routes: `component: "api.<resource>.<verb>"` (e.g. `"api.ocr.confirm"`)
   - Inngest functions: `component: "inngest.<functionName>"` (e.g. `"inngest.refillAlert"`)
2. Rename the 2 sites in `apps/web/app/api/ocr/confirm/route.ts` (lines 105 + 121): `component: "ocr.confirm"` → `"api.ocr.confirm"`. Pre-grep result attached in the PR description for reviewer confirmation.

**Acceptance (verifiable):**

- `grep -rnE 'component:\s*"[a-z]+\.[a-z]+"' apps/web/app/api/` returns only matches starting with `api.` (or the convention's other valid forms)
- `cd apps/web && npx vitest run` — full suite still green (no behavior change; any tests asserting the old tag name need updating in-PR)
- Pre-commit + CI green on PR

**Risk + mitigations:**

- Risk: Sentry dashboard filters that target the OLD tag names will silently miss new captures. Mitigation: PR description lists each tag rename so dashboards can be updated.

## Merge order

**T2 → T1, sequential.** TD-176 (docs + 2-line tag sweep) merges FIRST. T1's `refillAlert.ts` Sentry call site then uses the documented `component: "inngest.refillAlert"` from the start. No "alternative" — sequential merge order is the only path; this kills the conditional ambiguity from cycle-1 review.

## Risks accepted (logged per /sprint Step 4)

- **M3 (notification opt-out)** — not in scope; defense-in-depth via `List-Unsubscribe` header. File ON-71c follow-up.
- **Resend failure leaves dedup row** — one-shot failed send = no email for that week. Trade-off: prefer "miss one alert" over "send duplicate alerts on retry". Documented in `refillAlert.ts` step block.
- **No bounce/soft-fail handling** — file ON-71d if dashboard observation surfaces real bounce volume.

## Execution gate

Run `/opus-on-opus docs/plans/2026-05-17-on-71-phase2-refill-email-dispatch.md --from-sprint` before dispatch. Apply must-fix findings. Reviewer must verify each threat-model finding maps to a track/acceptance line.

## Post-merge verification

- `git pull && cd apps/web && npx vitest run && npx tsc --noEmit && supabase test db`
- Manual: trigger the Inngest function locally, observe email arrives at test inbox with correct batched body, observe second invocation logs "already dispatched"
- Sentry dashboard: confirm new captures appear under the documented tag shape
- After 1 day in prod: `email_dispatch_log` count should match Sentry-observed cron run count (1:1)

## Open questions

None outstanding. Schema verified, threat model selections finalized, all C+H+selected M findings have mapped acceptance criteria.
