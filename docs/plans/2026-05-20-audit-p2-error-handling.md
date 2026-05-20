# Audit P2 — error-handling cleanup (TD-204/205/206)

**Date:** 2026-05-20
**Base SHA:** 4f87a98c2519a6222079f6cb6d732408cfb670e1
**Source backlog:** TD-204, TD-205, TD-206
**PRD:** n/a
**Recommended executor:** /sprint (full pipeline) — invoked from Gate 2.

## Goal

Close three "swallowed-error" robustness gaps surfaced by the 2026-05-20 `/interpretable`+`/robust` audit (PR #665), after the P1s (TD-202/203) already shipped: a billing checkout route that builds malformed sessions and orphans Stripe customers, a history export that silently drops care data on query error, and journal hooks that swallow non-queue errors. All three are error-path correctness — happy paths already work.

## Non-goals

- No new features, UI, or schema changes.
- No refactor beyond the named error paths (no broad hook restructuring — TD-206 is scoped to the two real gaps, not a blanket rewrite; `toast.error` already exists at useJournalActions:58/113/144).
- No change to the existing auth / coordinator-gate / origin-pinning in the Stripe routes (preserve F-010/H5).
- No PHI/journal-body in any new log, toast, or Sentry capture (PHI rule, ADR-0001).

## Tracks

### Track 1 — stripe-checkout-errors

**Sources backlog TD-204.**

**FILES ALLOWED:**
- `apps/web/app/api/stripe/checkout/route.ts`
- `apps/web/app/api/stripe/portal/route.ts`
- `apps/web/app/api/stripe/checkout/__tests__/*` + `portal/__tests__/*` (add/extend)

**FILES OUT OF SCOPE — DO NOT TOUCH:** the Stripe webhook route (TD-202, shipped), `lib/stripe.ts`, any non-stripe route, lockfiles.

**Branch:** `fix/td-204-stripe-checkout-errors` off base SHA.

**Model:** `opus-advised-sonnet` — high confidence, bounded diff; Opus reviews (billing surface).

**Implementation steps:**
1. `checkout/route.ts:78` — after computing `priceId` from env, guard: `if (!priceId) { logger.error("stripe price env missing", { interval }); return 400 "Billing temporarily unavailable" }` BEFORE building the session. Never pass `price: undefined` to `checkout.sessions.create`.
2. `checkout/route.ts:65-74` — make get-or-create atomic against orphans. The `organizations.update({ stripe_id })` result is currently discarded — destructure it as `const { error: stripeIdUpdateError } = await supabaseAdmin.from("organizations").update(...)`. If `stripeIdUpdateError`, return 500 (the customer now exists in Stripe but unlinked — `logger.error("stripe customer orphaned", { customerId })` for reconciliation; do NOT leak the customer id to the client).
3. `checkout/route.ts:26,41` + `portal/route.ts:26,41` — the membership/org `.single()` calls discard `error` (destructure only `data`). Capture as `{ data, error }`; on a transport error (not just null data) return 500, not a misleading 403/404. Keep deny-by-default: missing membership/non-coordinator still 403.
4. Preserve existing zod, `getRequestUser` auth, coordinator gate, origin-pinning verbatim.

**Acceptance (verifiable):**
- Test: env price unset → POST returns 400, no `checkout.sessions.create` call (mock asserts not-called).
- Test: `organizations.update` error after customer-create → 500; client body has no Stripe customer id.
- Test: membership `.single()` transport error → 500 (not 403).
- `grep -nE "stripeIdUpdateError|error: membershipError|error: orgError|, error }" apps/web/app/api/stripe/checkout/route.ts apps/web/app/api/stripe/portal/route.ts` finds the new checks (full paths — bare `route.ts` matches nothing from repo root).
- `grep -n "if (!priceId)" apps/web/app/api/stripe/checkout/route.ts` finds the fail-closed guard.
- `cd apps/web && npx vitest run app/api/stripe` green; CI green.

**Risk:** billing correctness — mitigated by fail-closed + preserved authz; Opus review.

### Track 2 — history-export-errors

**Sources backlog TD-205.**

**FILES ALLOWED:**
- `apps/web/lib/buildHistoryExport.ts`
- `apps/web/lib/__tests__/buildHistoryExport*` (add)

**FILES OUT OF SCOPE — DO NOT TOUCH:** the export route(s) (`app/api/history/export/pdf/route.tsx`, `server/routers/historyExport.ts` — they already 500 on throw), PDF rendering, any other lib.

**Branch:** `fix/td-205-history-export-errors` off base SHA.

**Model:** `opus-advised-sonnet` — high confidence; Opus reviews (PHI/RLS-bypass surface).

**Implementation steps:**
1. `buildHistoryExport.ts:110-130` — steps 3/4/5 (`care_events`, `medications`, `symptom_readings`) currently destructure only `data` and discard `error`. Capture `error` on each and **throw** on it (fail-closed) — matches the existing recipient/vault pattern at :85/:97. A partial snapshot must never be returned as complete.
2. Error messages must be generic (`"Care events fetch failed"`) — no PHI, no recipient name, no raw Postgres error string in the thrown message (it propagates to the route's 500 + Sentry).
3. **OUT OF SCOPE (do NOT do):** narrowing the `supabaseAdmin: SupabaseClient<any>` param at :80 to `<Database>`. The existing `as CareEventRow[]` casts exist precisely because the schema type doesn't match — narrowing cascades type churn into those casts. If desired, seed a separate TD row; this track is error-handling only.

**Acceptance (verifiable):**
- Test: `care_events` query returns `{ data: null, error }` → `buildHistoryExport` throws (does not return a snapshot with empty events).
- Test: thrown error message contains no `full_name`/`dob`/recipient PHI (sentinel assertion).
- `grep -nE "careEventsError|medicationsError|symptomError" apps/web/lib/buildHistoryExport.ts` finds the new checks on all three queries (full path).
- `cd apps/web && npx vitest run lib/buildHistoryExport` green; CI green.

**Risk:** silently changing export completeness semantics — mitigated: throwing is strictly safer than today's silent-empty; route already handles 500.

### Track 3 — journal-hook-errors

**Sources backlog TD-206 (RE-SCOPED per Step-3a verify-row: stale — `toast.error` already at useJournalActions:58/113/144; real gaps are narrower).**

**FILES ALLOWED:**
- `apps/web/hooks/useJournalActions.ts`
- `apps/web/hooks/useJournalData.ts`
- `apps/web/hooks/__tests__/useJournal*` (add/extend)

**FILES OUT OF SCOPE — DO NOT TOUCH:** journal components/routes under `app/(app)/journal/`, offline-queue lib, other hooks.

**Branch:** `fix/td-206-journal-hook-errors` off base SHA.

**Model:** `opus-advised-sonnet` — high confidence; Opus reviews (PHI surface).

**Implementation steps:**
1. `useJournalActions.ts:45-64` (`handlePost` offline branch; catch at :56-62) — the `catch (e)` only toasts on `QueueFullError`; any other error is swallowed silently. Add an `else` toast (generic: `"Couldn't save offline — try again"`). **Note: the offline branch has NO `posting` flag** — `setPosting(true)` is set only in the online path *after* the offline `return` at :63 — so there is no `finally`/reset to add here. Toast only. NO journal text in the toast/log.
2a. `useJournalData.ts:86-94` (`loadMembers`) — a **`fetch` Response** shape: currently `if (data.members) { ... }` with no else, so a failed request silently leaves members stale and `currentUserRole` unset. Add a `!res.ok` (or `data.error`) check → `toast.error("Couldn't load care team")` (generic, no member PHI); leave state unchanged (don't fabricate).
2b. `useJournalData.ts:~100` (`loadRecipients`) — a **Supabase `.from()`** shape returning `{ data, error }` (NOT a Response — different shape from 2a). Capture and check `error` → `toast.error("Couldn't load recipients")` (generic; `display_names.full_name` is PHI — never in the toast/log). Skip if it materially expands the diff; the `loadMembers` gap is the primary one.
3. Confirm no `posthog.capture`/`Sentry` call in these hooks receives journal body or member PHI (grep; none today — keep it that way).

**Acceptance (verifiable):**
- Test: `handlePost` offline non-QueueFull error → a generic error toast fires (not silent).
- Test: `loadMembers` fetch !ok → error toast fires, members state not corrupted.
- Sentinel: no test/grep finds journal `text`/`mood` or member `display_name`/`full_name` passed to `toast`/`logger`/`posthog`/`Sentry` in these files.
- `cd apps/web && npx vitest run hooks/useJournal` green; CI green.

**Risk:** over-toasting — mitigated by scoping to the two genuine silent paths, not every call.

## Merge order

**All independent — any order.** Zero file overlap (Stripe routes / lib export / journal hooks). Three separate PRs; each merges on its own green CI.

## Execution gate

Run `/opus-on-opus docs/plans/2026-05-20-audit-p2-error-handling.md` before dispatch. Apply must-fix.

## Post-merge verification

- `git pull && cd apps/web && npx vitest run app/api/stripe lib/buildHistoryExport hooks/useJournal` on integrated main.
- No prod-visible behavior change beyond error surfacing — `/post-deploy-watch` not required.

## Note on execution mode

3 disjoint tracks. Per global "Implementation Strategy Default" (dispatch only at 4+ independent tracks), `/wave` may run these **direct** (sequential, same session) rather than parallel-dispatch — the cherry-pick overhead isn't worth it at 3. Tracks are written dispatch-ready regardless.
