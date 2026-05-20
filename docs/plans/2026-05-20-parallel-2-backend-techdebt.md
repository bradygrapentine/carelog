# Parallel Sprint Plan — backend tech-debt (2 tracks)

**Date:** 2026-05-20
**Base SHA:** `ef5bb18f246f044369d9a74d5bc7c2d6911977dd`
**Tracks:** 2 (track assignment decoupled — any session executes any unclaimed track via `/sprint --session <alias> --track <name> <this-plan-file>`)
**Close:** Any session calls `/parallel-sprint-close docs/plans/2026-05-20-parallel-2-backend-techdebt.md` after all tracks have written outcome.json sidecars.

## Theme

Two independent backend tech-debt items surfaced by `/oop --from-sprint` and `/sprint` scoping. Disjoint file scopes, S↔M effort balance.

## Disjoint-ness verified

| Track | Owned files |
|---|---|
| A (TD-192) | `apps/web/server/repositories/membershipsRepository.ts` (+ test), `apps/web/server/repositories/identityRepository.ts` (+ test), `apps/web/sentry.server.config.ts` (+ sentinel test) |
| B (TD-187) | `apps/web/inngest/functions/weeklyDigest.ts` (+ test). **No migration needed** — `email_dispatch_log.kind` is free-text (`text NOT NULL`, no CHECK), verified. |

Pair-intersection: A ∩ B = ∅ ✅

**Soft-dep check:** `weeklyDigest.ts` does NOT import `membershipsRepository` (verified) — fully independent. Track A changes only error-message strings/`cause`, never function signatures, so even transitive consumers are unaffected.

**Shared finalizer-only files:** `BACKLOG.md` (§0 board), `CONTEXT.md` (additive only). Tracks A/B MUST NOT touch these.

**Forbidden-shared check:** none found.

## Effort balance (§3.5)

| Track | Bucket | Rationale |
|---|---|---|
| A (TD-192) | **S** (~1.5h) | 5 throw-site migrations + 1 normalize + 1 Sentry config + test updates; no new files |
| B (TD-187) | **M** (~3h) | idempotency guard + tests + Sentry-on-conflict; reuses existing `email_dispatch_log` table |

S↔M is within one bucket ✅.

## Executor contract (applies to both tracks)

1. **`cd <worktree>`** at session start; never operate from repo root.
2. **`git branch --show-current`** before every commit; abort on mismatch.
3. **Stage explicit file lists** (`git add <files>`) — never `git add .` / `git commit -a`.
4. **Pre-granted Bash:** `gh pr create`, `gh pr merge --auto --squash`, `gh pr view`, `git push -u origin <branch>`, `pnpm`, `npx`, `cd`, `grep`, `cat`, `ls`, `supabase`.
5. **Heartbeat:** append a timestamp every ~5 min to `.claude/agent-status/td-<id>.log`.
6. **PR body:** list files changed + intentionally-NOT-changed.
7. **node_modules** is symlinked (root + `apps/web`); vitest resolves without reinstall. If a run still fails on resolution, `pnpm install` in the worktree (documented pnpm+worktree gotcha) — `--no-verify` only after confirming env-pre-existing with changes stashed.
8. **PHI rule:** never pass email/name/phone/PII to `posthog.*` or `Sentry.*`. TD-192 part (c) is explicitly a PHI-hardening task — the whole point is to keep Postgres error detail (which can echo column values) out of Sentry.

## Worktrees (pre-created)

- Track A: `worktrees/td-192-stable-error-codes/` (branch `feat/td-192-stable-error-codes`)
- Track B: `worktrees/td-187-weeklydigest-idempotency/` (branch `feat/td-187-weeklydigest-idempotency`)

Both branch from base SHA `ef5bb18`. node_modules symlinked at root + `apps/web`.

## Track A — TD-192 — Stable error-code pattern across repository layer + Sentry cause hygiene

**Worktree:** `worktrees/td-192-stable-error-codes/`
**Branch:** `feat/td-192-stable-error-codes`

**Files allowed:**
- `apps/web/server/repositories/membershipsRepository.ts` (+ its `__tests__`/colocated test)
- `apps/web/server/repositories/identityRepository.ts` (+ its test)
- `apps/web/sentry.server.config.ts`
- A new Sentry sentinel test under `apps/web/__tests__/` or colocated with sentry config (executor's call — must not collide with Track B paths)

**Files out of scope — DO NOT TOUCH:**
- `apps/web/inngest/functions/weeklyDigest.ts` and its test (Track B)
- `supabase/**` (Track B may add a migration)
- `BACKLOG.md`, `CONTEXT.md` (finalizer-only)
- All other application code

**Implementation steps:**
1. **(a)** `membershipsRepository.ts` — the 5 interpolated-message throw sites are at **lines 23, 80, 188, 251, 264** (verified against current main; the older backlog-row line numbers 161/219/232 are STALE — do not migrate code at those lines). The five: `Memberships fetch failed` (23), `getCareTeamForRecipient failed` (80), `getRefillRecipients failed` (188), `Membership creation failed` (251), `Invite token creation failed` (264). Migrate each to `throw new Error("<stable_snake_code>", { cause: error })`. Suggested codes: `memberships_fetch_failed`, `care_team_fetch_failed`, `refill_recipients_fetch_failed`, `membership_create_failed`, `invite_token_create_failed`. Update matching test assertions to check `err.message === "<code>"` and/or `err.cause`.
2. **(b)** `identityRepository.ts` — `updateEmergencyInfo` (~line 147) currently throws `` `identity_update_failed: ${error.code ?? "UNKNOWN"}` `` (code in `.message`). Normalize to the cause-bearing form: `throw new Error("identity_update_failed", { cause: error })` so all 3 identityRepository throw sites share one contract. **Two tests break and BOTH must be updated:** the `23505` assertion (~line 451) → `err.cause.code === "23505"`, AND the "UNKNOWN when error has no code" test (~lines 478/484) → assert on `err.cause` (the `UNKNOWN` fallback in `.message` no longer exists). Grep `identityRepository.test.ts` for `identity_update_failed` to find both.
3. **(c)** Sentry cause hygiene — `Error("…", { cause: pgError })` preserves the raw Postgres error via `.cause`; default Sentry serialization walks `cause` and can surface column values (PHI) to log aggregators. Pick ONE: (i) strip `cause` before `Sentry.captureException`, OR (ii) add a `beforeSend` hook in `sentry.server.config.ts` that walks `cause` and redacts `message`/`detail`. Document the choice inline. Add a sentinel test asserting a thrown `Error` with a `cause` carrying `detail: "Key (email)=(jane@x.com)"` does NOT survive into the captured event payload.

**Acceptance (verifiable):**
- `grep -nE "failed: \\$\\{[a-zA-Z]*[eE]rror" apps/web/server/repositories/membershipsRepository.ts` returns no matches (interpolated-message throws gone).
- `grep -cE "\\{ cause: [a-zA-Z]*[eE]rror \\}" apps/web/server/repositories/membershipsRepository.ts` returns ≥ 5 (positive assertion the migration happened — a deleted file would also pass the negative grep; the regex tolerates the `mError`/`iError` var names at sites 251/264).
- `grep -n "identity_update_failed\", { cause" apps/web/server/repositories/identityRepository.ts` returns 1 match.
- `cd apps/web && npx vitest run server/repositories sentry` green.
- Sentinel test proves no PHI fragment (`jane@x.com`) survives Sentry serialization.
- Full vitest suite green; CI green.

**Risks + mitigations:** Test assertions pinned to old message strings → update them in the same commit. Sentry `beforeSend` over-redaction → scope redaction to `cause.detail`/`cause.message` only, leave top-level message.

## Track B — TD-187 — weeklyDigest idempotency guard

**Worktree:** `worktrees/td-187-weeklydigest-idempotency/`
**Branch:** `feat/td-187-weeklydigest-idempotency`

**Files allowed:**
- `apps/web/inngest/functions/weeklyDigest.ts` (+ its colocated test)
- `supabase/migrations/<new-ts>_*.sql` + `supabase/tests/*.sql` — ONLY if `email_dispatch_log.kind` has a CHECK/enum constraint that must admit `'weekly_digest'`. The table already exists (`20260517010000_create_email_dispatch_log.sql`); reuse it. If `kind` is free-text, NO migration needed.

**Files out of scope — DO NOT TOUCH:**
- `apps/web/server/repositories/**`, `apps/web/sentry.server.config.ts` (Track A)
- `apps/web/inngest/functions/refillAlert.ts` (the reference impl — read it, don't edit it)
- `BACKLOG.md`, `CONTEXT.md` (finalizer-only)
- All other application code

**Implementation steps:**
1. Read `apps/web/inngest/functions/refillAlert.ts` for the established `email_dispatch_log` idempotency pattern (ON-71 Phase 2, PR #599). **Verified schema:** the table has columns `kind text`, `dedup_key text`, with `CONSTRAINT email_dispatch_log_kind_dedup_unique UNIQUE (kind, dedup_key)`. **There is NO `week_stamp` column** — the week is encoded INSIDE the composed `dedup_key` text. refillAlert composes `dedup_key = "refill:<org_id>:<recipient_id>:<iso_week>"` and INSERTs `{org_id, recipient_id, kind: "refill_alert", dedup_key}` BEFORE `resend.emails.send`; on `23505` unique-violation it skips.
2. **`kind` is free-text (no CHECK) — verified — so NO migration is needed.** Reuse the existing table as-is.
3. In `weeklyDigest.ts`: anchor `const now = new Date()` once at the top. weeklyDigest sends **one email per org** (to all members), NOT per-recipient — so the dedup is **org-level**: compose `const dedupKey = \`weekly_digest:${orgId}:${isoWeekStamp(now)}\`` (import `isoWeekStamp` from `@carelog/utils` — it takes a `Date`). Before each per-org Resend send, INSERT `{ org_id: orgId, kind: "weekly_digest", dedup_key: dedupKey }` into `email_dispatch_log`. On `23505` conflict, skip the send (already dispatched this week) + `Sentry.captureMessage`/breadcrumb the skip (NO PHI — `org_id` UUID + `kind` + `dedup_key` only; dedup_key carries no PII).
4. Add tests: (a) first run inserts the log row + sends; (b) second run for the same `(kind, dedup_key)` hits the unique-violation and skips (assert `resend.emails.send` not called the second time); (c) conflict path captured to Sentry with org-level identifiers only, no PHI.

**Acceptance (verifiable):**
- `grep -n "email_dispatch_log" apps/web/inngest/functions/weeklyDigest.ts` returns ≥1 match.
- `grep -nE "dedup_key|dedupKey" apps/web/inngest/functions/weeklyDigest.ts` returns ≥1 match (uses the real composite-key column, not a fictional `week_stamp`).
- `grep -n "isoWeekStamp" apps/web/inngest/functions/weeklyDigest.ts` returns ≥1 match (shared util, not a local copy).
- `grep -nE "week_stamp" apps/web/inngest/functions/weeklyDigest.ts` returns NO matches (sanity: the fictional column name never appears).
- `cd apps/web && npx vitest run inngest/functions/weeklyDigest` green, including the duplicate-skip regression test.
- Full vitest suite green; CI green. (No migration → no `supabase test db` needed unless one was unexpectedly added.)

**Risks + mitigations:** Re-send window if INSERT happens AFTER send (crash between send and log) → INSERT-before-send ordering. PHI in the skip log → assert org_id/kind/dedup_key only in the conflict-capture test. Wrong dedup granularity (per-recipient like refill) → weeklyDigest is org-level; dedup_key omits recipient_id.

## Merge order

Independent — either order. No soft-deps (verified: weeklyDigest doesn't import the repos; Track A changes no signatures).

## Execution gate

`/opus-on-opus docs/plans/2026-05-20-parallel-2-backend-techdebt.md --from-sprint` runs at plan authoring. Apply must-fix before executors start.

## Close protocol

When both tracks have written `.claude/state/sessions/<alias>/outcome.json` (status: complete), any session in repo root:

```
/parallel-sprint-close docs/plans/2026-05-20-parallel-2-backend-techdebt.md
```

The close skill does the single targeted BACKLOG.md tail-edit (flip TD-192 + TD-187 → §7 Shipped, recount §0) + claims.json + INDEX.md cleanup. NOT a full `/backlog-sync` (the pre-plan sync already ran). Per-track session dirs deleted last.
