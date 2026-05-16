# Reliability appendix — Inngest vs. Vercel Queues for carelog

**Companion to** `2026-05-15-inngest-vs-queues.md`. Read the primary doc first; this file expands Q4 (reliability semantics under failure) with worked walkthroughs.

---

## Why a separate file

The Q4 table in the primary doc summarizes failure modes at row level. This appendix walks through three failure scenarios end-to-end with the actual code path each vendor would take. The intent is to surface the *operational* differences — not just the marketing claims — so a future reader can audit the recommendation.

All vendor claims here are dated 2026-05-15. Vercel Queues is still in public beta as of retrieval; some nuance is sparsely documented and noted explicitly where that's the case.

---

## Scenario 1 — Transient Postgres error mid-step

Carelog's `weeklyDigest` (`apps/web/inngest/functions/weeklyDigest.ts:119-284`) does:

1. `step.run('find-active-orgs', ...)` — one query, returns N orgs.
2. `Promise.all(orgs.map(({ orgId }) => step.run('send-digest-' + orgId, ...)))` — per-org steps that fetch org metadata, journal entries, memberships, shifts, and call Resend.

Suppose step 2 for `org-A` throws on a transient Supabase `57P01 admin_shutdown` (Postgres connection pool restart) at the `memberships` query (`weeklyDigest.ts:192-198`).

### Inngest behavior

- Inngest catches the throw, marks step `send-digest-org-A` as failed, schedules a retry with exponential backoff (default).
- Step `find-active-orgs` checkpoint is **reused** — Inngest does not re-run it.
- Other `send-digest-*` steps that succeeded keep their successful state.
- After retry budget exhausts (default 4 attempts), Inngest emits `inngest/function.failed`. Sentry middleware fires (`client.ts:11-15`).
- Operator sees one trace in Inngest UI with red `send-digest-org-A` step + replay button.

### Queues behavior

- Consumer `handleCallback` throws → message redelivered after visibility timeout.
- Next invocation re-runs the *entire* handler from the top — including the `find-active-orgs` query and all the *other* `send-digest-*` work.
- If `Resend` was already called for `org-B` in the first attempt, it gets called again unless the handler tracks idempotency in the DB.
- After max attempts (per visibility config), message expires or moves to a DLQ-equivalent. Sentry must be invoked manually in the catch.

### Operational implication for carelog

- `weeklyDigest` already has `await step.sleep('stagger-' + orgId, digestMinuteOffset(orgId) + 's')` (`weeklyDigest.ts:244`) to stagger emails. On Queues, `step.sleep` becomes `delaySeconds` on `send()` — meaning each org needs its own message, not one batch message.
- That means a Queues-shaped `weeklyDigest` is **N+1 messages** (1 trigger + N per-org sends) instead of 1 invocation. Operationally fine, but the function's shape changes — it's no longer a single durable function with fan-out steps, it's a fan-out router publishing to a per-org consumer queue.
- Idempotency for "did we email org-A this week?" has to live in a `digest_sends` table (carelog has `cron_runs` but not a per-org `digest_sends`); without it, Resend double-charges.

---

## Scenario 2 — Postgres lock contention on TD-144 atomic OCR confirm

TD-144 in the backlog: "Atomic OCR confirm via `SECURITY DEFINER` RPC + `SELECT FOR UPDATE`." The race is that two concurrent confirms on the same OCR document could both succeed.

Hypothetical shape if implemented as a background job:

```ts
await step.run('atomic-confirm-ocr', async () => {
  await supabaseAdmin.rpc('confirm_ocr_atomic', {
    p_ocr_id: ocrId,
    p_user_id: userId,
  })
})

await step.run('audit-log-insert', async () => {
  // SEC-007 append-only audit row
  await supabaseAdmin.from('ocr_confirm_audit').insert({
    ocr_id: ocrId,
    user_id: userId,
    confirmed_at: new Date().toISOString(),
  })
})
```

Now suppose `SELECT FOR UPDATE NOWAIT` inside `confirm_ocr_atomic` raises `55P03 lock_not_available` because another worker has the row locked.

### Inngest behavior

- Step `atomic-confirm-ocr` throws → Inngest retries it after backoff.
- The `audit-log-insert` step has not run yet (depends on the previous step's success).
- On retry, only `atomic-confirm-ocr` re-runs. If it succeeds the second time, `audit-log-insert` runs once.
- Net: one OCR confirm, one audit row. SEC-007 invariant intact.

### Queues behavior

- `handleCallback` throws on the RPC failure → message redelivered.
- On retry, handler runs from the top: re-attempts `confirm_ocr_atomic`. If it succeeds, `audit-log-insert` runs.
- But: what if on attempt 1 the RPC succeeded internally (lock acquired, row updated) and then *crashed before returning* (visibility timeout fired, message considered unacked)?
  - Inngest: step return value is checkpointed — if the runtime crashes mid-step, the next attempt re-runs that step (idempotency required at the SQL level).
  - Queues: handler re-runs from the top. RPC re-runs with the same idempotency contract.
- The OCR confirm itself should be idempotent in SQL (TD-144 should make it so by design). But the **audit-log row** must also be idempotent on `(ocr_id, user_id, confirmed_at_window)`. Currently SEC-007 is append-only by design.

### Operational implication

For TD-144 specifically, Inngest's per-step retry isolation is **safer by default** — only the contended step retries, not the whole handler. On Queues, the audit-log insert needs an idempotency key (`UNIQUE` index on `(ocr_id, attempt_id)` or similar) to prevent SEC-007 from accidentally double-recording confirm attempts that retry due to lock contention.

Carelog already implements pragmatic idempotency (the DB-level checks in `refillAlert.ts:59-71` and `gapDetector.ts:124-136` show the team understands the discipline). But it's an extra rule to enforce, and a regression vs. the current Inngest model.

---

## Scenario 3 — Step timeout

Vercel Pro's default function timeout is 300 seconds for Fluid compute (per Vercel docs, retrieved 2026-05-15). Inngest's per-step timeout is configurable per step.

### Long-running step (e.g., OCR with external API call)

`ocrPrescription` and `ocrDocument` likely call an external OCR API (the carelog repo has these as Inngest functions). If the OCR API takes 4 minutes:

- **Inngest:** Configure `step.run` with a longer timeout per step. The step's parent Inngest function can run for hours (Inngest is durable execution — function lifetime is decoupled from any individual HTTP call lifetime).
- **Queues:** Consumer is a Vercel function. Limited to the function's `maxDuration` (300s on Pro). If OCR takes longer, the message is considered timed out, redelivered, OCR re-attempted, double-charged to the OCR vendor.

### Operational implication

For OCR specifically (TD-144 + the existing `ocrPrescription` / `ocrDocument` / `documentsExtractText` functions), the durable-execution model is *materially better* for long-running steps. A Queues-based design would need either: (a) external OCR with a webhook callback that publishes a follow-up message, or (b) splitting the OCR pipeline into many small messages.

Both are workable but represent meaningful architectural rework.

---

## DLQ patterns

### Inngest

- `inngest/function.failed` system event fires when a function exhausts its retry budget.
- Subscribe a recovery function via `inngest.createFunction({ id: 'on-failure' }, { event: 'inngest/function.failed' }, ...)`.
- Inngest UI shows failed runs with replay button.
- Carelog's existing `cron_runs` table (`refillAlert.ts:106-112`) is a poor-man's DLQ tracker; the proper Inngest pattern is the failure event.

### Vercel Queues

- Vercel Queues docs (retrieved 2026-05-15) describe visibility timeout, retry, and message expiry, but the DLQ surface specifically is not as thoroughly documented in the public-beta state. The changelog mentions "redelivers messages to consumer groups until successfully processed or expired" — implying expired messages drop, not move to a queryable DLQ.
- Recovery would likely be: catch in the handler, log to Sentry, write to a custom `failed_queue_messages` table in Postgres.
- This is a real gap vs. Inngest's first-class failure pattern.

---

## Retry budget tuning

| Aspect | Inngest | Queues |
| --- | --- | --- |
| Default attempts | 4 (configurable per function) | Per visibility timeout × max receives (configurable per trigger) |
| Backoff shape | Exponential, configurable | Visibility-timeout-based; redelivery is not exponential by default |
| Per-step vs per-function | Per-step retries with checkpointing | Per-message only |
| Custom retry conditions | `NonRetriableError` class to opt out | Throw → retry; return → ack. No fine-grained control. |

Inngest's `NonRetriableError` is a useful escape hatch when a step should fail-fast (e.g., 4xx from Resend means the email is malformed, don't retry). Queues' on/off semantic is coarser.

---

## Postgres-specific reliability notes

Carelog uses Supabase Postgres 15 with RLS. Two things matter:

1. **Connection pool exhaustion.** Vercel functions can hammer Supabase's connection pool if concurrency is unbounded. Both Inngest and Queues offer per-function concurrency limits — but Inngest's is more granular (configurable per step within a function via `concurrency` config).
2. **`SELECT FOR UPDATE` lock holds.** A locked row in a transaction blocks other transactions. If a step times out while holding a lock, the lock releases when Postgres detects the dead connection — but that can take 60+ seconds. Both vendors have the same risk; the difference is in retry granularity (see Scenario 2).

---

## Summary

The reliability comparison favors Inngest at carelog's current shape:

- Per-step retry isolation matches the carelog code pattern (every function uses `step.run`).
- Failure events are first-class.
- Long-running steps don't bump against Vercel function timeouts.
- Sentry middleware is one-time setup; per-handler discipline isn't required.

Queues is fine for greenfield message-driven work where the team designs idempotency in from day one. Retrofitting 14 existing step-composed functions to whole-handler-retry is a measurable regression in the operational story, not just a code refactor.

This appendix's findings reinforce the primary doc's "stay on Inngest" recommendation. Re-evaluate when Vercel Workflow's step model is GA and well-documented — at that point a like-for-like migration becomes much closer to break-even.
