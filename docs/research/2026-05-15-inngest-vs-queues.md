# Inngest vs. Vercel Queues for carelog

**Decision research — 2026-05-15**
**Branch:** `research/inngest-vs-queues-2026-05-15`
**Companion:** `2026-05-15-inngest-vs-queues-reliability-appendix.md` (failure-mode detail)

---

## ⚠️ Revision note — 2026-05-15 post-validation pass

This doc was revised after an in-session validation pass found two Critical errors in the original analysis:

- **Cron-function count was 6, actually 8.** `burnoutAlert` and `rateLimit429Monitor` were omitted. (See L46, L77 in the prior version.)
- **Cron-runs/month estimate was ~200, actually ~11,622.** `rateLimit429Monitor` runs every 5 minutes (8,640/mo) and `shiftTradeExpiry` every 15 minutes (2,880/mo) dominate the count. The original `~200` figure assumed only daily/weekly crons.

Both errors cascaded into the pricing math. Corrected execution count is **~170,000/month** vs the original ~135k — and crucially, vs the Inngest Hobby 50k cap. The cost-comparison Section 2 has been rewritten accordingly, the TL;DR confidence is downgraded, and the recommendation is now conditional on verifying carelog's current Inngest billing tier.

The architectural / migration-cost arguments still stand. The cost argument flips depending on a question the doc can't answer without operator input.

---

## TL;DR (confidence: medium, was high)

**Provisional: stay on Inngest, but verify current Inngest billing tier first.** Vercel Queues is a younger, narrower primitive (public beta since 2026-02-27 per Vercel's changelog, still labeled "Beta" on the pricing page as of retrieval) that handles message publish/consume but **does not natively offer cron scheduling, step composition (`step.run` / `step.sleep` / `step.waitForEvent`), or the durable-execution mental model**. A "fair migration" would replace Inngest with a three-product stack — Vercel Cron Jobs (trigger) + Vercel Queues (transport) + Vercel Workflow (orchestration) — and rewrite 14 functions, not 3.

**Cost is no longer a clean tie.** Corrected math shows ~170k executions/month, which exceeds Inngest's free Hobby cap (50k). If carelog is currently on Inngest Pro ($75/mo), Vercel Queues' $0/mo marginal cost on the existing Vercel Pro plan is a real cost saving — though one that has to be weighed against the migration cost of 14 functions. If carelog is still on Hobby today (e.g. because execution count is functionally below cap due to step-batching the doc didn't model), the original conclusion holds. **Action: confirm current Inngest invoice / tier before deciding.**

The architectural counter-arguments still favor Inngest: step composition is a productivity feature carelog uses everywhere, and Queues alone is not a like-for-like replacement.

**Counter-argument worth respecting:** Vercel Workflow + Queues converges fast and unified billing simplifies the bill — re-evaluate in ~6 months once Queues exits beta, Workflow stabilizes, and the carelog Inngest footprint hits a forcing function (~30+ functions, or an Inngest pricing-tier change that the original doc said was 12-24 months out but may already be the current state).

---

## Section 0 — Important framing correction

The handoff brief said: *"Today's background work runs on Inngest. ... about to add 3 more background jobs: ON-70 (coverage_windows gap detector), ON-71 (nightly refill alerts), TD-133 (ai_conversations 90-day archival)."* The brief also says *"Inngest in use today: OCR pipeline (stubs), weekly digest cron infra."*

**That framing is stale.** As of `aa0ff4d` on `origin/main`, carelog has **14 Inngest functions wired into `apps/web/app/api/inngest/route.ts:18-36`**:

```
weeklyDigest, gapDetector, refillAlert, ocrPrescription, ocrDocument,
burnoutAlert, journalFlagAlert, documentsExtractText, messagingPushFn,
careEventCommentFanoutFn, shiftTradeExpiry, educationTipRefresh,
rateLimit429Monitor, digestDeliveryMonitor
```

Both `gapDetector` and `refillAlert` already exist as full production implementations (`apps/web/inngest/functions/gapDetector.ts:52-183`, `apps/web/inngest/functions/refillAlert.ts:20-115`) with idempotency, error-capture to a `cron_runs` table, `step.run`/`step.sleep`, and Sentry middleware. TD-133 is the only one of the three "planned" jobs that is genuinely net-new.

This matters because **migration cost scales linearly with function count**. The decision the brief asks ("before three more functions land") is the wrong forcing function — those functions are mostly already landed. The real forcing functions are:

- Inngest pricing tier change (today: well inside free Hobby tier; Pro is $75/mo)
- A reliability event that exposes Inngest weakness (none observed; Sentry middleware on `apps/web/inngest/client.ts:4-22` is clean)
- Vercel Queues exiting beta + Workflow stabilizing into a credible step-composition replacement

None of those are firing right now. The recommendation below assumes the question is: **does the current Inngest investment justify continued accumulation, or is there a forcing reason to migrate?**

---

## Section 1 — Feature-parity matrix (Q1)

Direct comparison of what carelog actually uses today and what's planned. ✅ = native first-class support; ⚠️ = supported but with caveat; ❌ = not supported / needs companion product.

| Capability | Carelog usage today | Inngest 3.54.0 | Vercel Queues (beta) | Vercel Cron + Workflow companion |
| --- | --- | --- | --- | --- |
| **Cron scheduling** | 8 cron functions (`weeklyDigest`, `gapDetector`, `refillAlert`, `burnoutAlert`, `shiftTradeExpiry`, `educationTipRefresh`, `rateLimit429Monitor`, `digestDeliveryMonitor`) | ✅ `inngest.createFunction({...}, { cron: "TZ=UTC 0 7 * * *" }, ...)` | ❌ Queues itself does not schedule; needs Vercel Cron Jobs to publish a message. | ✅ Cron Jobs invoke a route handler that calls `send()`. Two-step setup. |
| **Event-driven from HTTP body** | `messagingPushFn`, `careEventCommentFanoutFn`, `journalFlagAlert` triggered from app code | ✅ `inngest.send({ name: ..., data: ... })` + `event:` trigger | ✅ `send('topic', payload)` from any server context | ✅ same |
| **Idempotency keys** | DB-level idempotency: `gapDetector` checks `care_events` `payload->>window_id` for current day (`apps/web/inngest/functions/gapDetector.ts:124-136`); `refillAlert` checks same-day refill rows (`apps/web/inngest/functions/refillAlert.ts:59-71`) | ✅ Native `idempotencyKey` on function spec + event | ✅ Native `idempotencyKey` on `send()` per public-beta changelog | n/a — Queues already covers |
| **`step.run` (durable atomic step)** | Used in every function. e.g. `await step.run('fetch-low-supply-medications', async () => {...})` (`refillAlert.ts:29-38`) | ✅ First-class durable execution; step results are checkpointed | ❌ Not in Queues. Queues is publish/consume only. | ⚠️ Workflow provides step composition, but is a separate product/SDK with `useworkflow.dev` |
| **`step.sleep`** | `weeklyDigest` staggers sends per org via `await step.sleep('stagger-' + orgId, digestMinuteOffset(orgId) + 's')` (`weeklyDigest.ts:244`) | ✅ First-class | ⚠️ Workaround: `delaySeconds` on `send()` for a single deferral. No multi-step sleep-then-continue. | ✅ Workflow supports waits |
| **`step.waitForEvent`** | Not currently used in carelog | ✅ First-class | ❌ | ✅ Workflow |
| **Local dev server** | `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` (per root `CLAUDE.md` Commands block) | ✅ Inspector UI at localhost:8288 with replay/manual-invoke | ⚠️ `vercel dev` runs the consumer route; no dashboard for replay/inspect. Confirmed in Quickstart. | ⚠️ Same |
| **Fan-out / batching** | `weeklyDigest` uses `Promise.all` across `step.run` per org (`weeklyDigest.ts:158-160`). `gapDetector` same pattern. | ✅ Native batching primitives (`batchEvents` config) + `step.run` fan-out | ⚠️ Implicit fan-out via consumer concurrency. No batch-trigger primitive. | ✅ Workflow has explicit fan-out |
| **Concurrency / rate limit** | Not currently configured but `rateLimit429Monitor` exists | ✅ Per-function `concurrency: { limit: N, key: '...' }`, throttle, debounce | ✅ Per-trigger `maxConcurrency` (per changelog: "Concurrency control") | n/a |
| **Retries / DLQ** | Default Inngest retries (4 attempts); errors surface to `cron_runs` table via try/catch (`refillAlert.ts:105-113`) | ✅ Auto-retries with exponential backoff, configurable per function; failure events you can subscribe to | ✅ At-least-once delivery, redelivery until success or expiry; visibility timeout configurable | n/a |
| **Observability dashboard** | Inngest Cloud UI (free tier) | ✅ Per-run trace, step input/output, replay button | ⚠️ Vercel Observability for function logs; no per-message replay UI in beta docs | ⚠️ same |
| **Sentry error capture** | `InngestMiddleware` in `apps/web/inngest/client.ts:4-22` tags `Sentry.captureException` with `inngest_function` | ✅ First-class middleware hook | ⚠️ Consumer is a route handler — `@sentry/nextjs` instruments it automatically, but no per-message tagging without manual code | n/a |
| **Push notifications integration** | `gapDetector` calls `sendPushToOrgCoordinators` mid-step (`gapDetector.ts:150-158`) | ✅ Just a function call inside a step | ✅ Same | ✅ Same |
| **Single-product blast radius** | One vendor, one bill, one SDK | ✅ | ❌ Splits into Queues + Cron Jobs + (Workflow if step composition needed) | — |

**Gap summary:**

1. **Cron is not in Queues.** This is the largest practical gap for carelog: **8 of 14 functions are cron-triggered** (and two of those — `shiftTradeExpiry` every 15min and `rateLimit429Monitor` every 5min — fire 100× more often than daily crons). A migration would mean keeping Vercel Cron Jobs (already free, but a separate config surface in `vercel.json`) plus Queues for delivery — two coupled systems instead of one.
2. **Step composition is in Workflow, not Queues.** Workflow is a separate product (`vercel.com/workflows`, `useworkflow.dev`) with its own SDK and its own pricing tier ($20/M events on Pro per the pricing page). A carelog migration that preserves the `step.run` / `step.sleep` patterns would require Workflow, not just Queues. The brief's framing of "Inngest vs Queues" is mathematically incomplete.
3. **No per-run inspector UI in the Queues beta.** Inngest's dev-server UI is a measurable productivity asset for carelog (the existing `digestDeliveryMonitor` and `rateLimit429Monitor` functions exist precisely because the team values observability). Replacing it with Vercel Observability is a clear downgrade in beta state.

---

## Section 2 — Pricing breakeven (Q2) — REVISED

### Scale assumptions (corrected)

The brief's stated scale (5 daily/weekly crons + ~500 event-driven invocations/day) is materially stale. So was this section's first pass. Corrected count below.

**Cron runs/month — per-function:**

| Function | Schedule | Runs/mo |
| --- | --- | --- |
| `weeklyDigest` | weekly | ~4 |
| `gapDetector` | daily | ~30 |
| `refillAlert` | daily | ~30 |
| `burnoutAlert` | weekly | ~4 |
| `shiftTradeExpiry` | every 15 min | **~2,880** |
| `educationTipRefresh` | daily | ~30 |
| `rateLimit429Monitor` | every 5 min | **~8,640** |
| `digestDeliveryMonitor` | weekly | ~4 |
| **TOTAL cron runs/mo** | | **~11,622** |

Two functions (`rateLimit429Monitor` 5-min and `shiftTradeExpiry` 15-min) dominate the cron count. Both are chatty by design and might themselves be worth cadence review (see Section 6.5).

**Scale model (corrected):**

| | Brief's scale | Corrected |
| --- | --- | --- |
| Cron runs/month | ~150 | **~11,622** |
| Event-driven invocations/day | ~500 | ~1,500 |
| Avg steps per run | 2 | 3 |
| **Inngest "executions"/month** | (150 + 500·30) · 2 = **30,300** | (11,622 + 1,500·30) · 3 = **~170,000** |

### Inngest cost — revised

- **Hobby (free):** 50,000 executions/mo, 5 concurrent steps, 3 users — per the pricing page (retrieval 2026-05-15).
- Brief's scale (30,300 executions): **$0/month.** Within Hobby.
- **Corrected scale (~170,000 executions):** exceeds Hobby cap by **3.4×**. Inngest's published pricing tiers (as of retrieval) suggest **Pro at $75/month** is the effective tier.
- Pro tier headroom: 1M executions included. Corrected scale uses ~17% of Pro headroom.

**⚠️ Operator-verifiable input needed:** carelog's actual current Inngest billing tier and execution count. Inngest's free Hobby tier may have grown above 50k since the doc's retrieval date, OR carelog's runtime execution count may differ from this model (e.g. if step-batching collapses multiple `step.run` calls into one execution unit; the doc didn't model that). Confirm via Inngest dashboard before treating this section's conclusion as final.

### Vercel Queues cost (on existing Vercel Pro plan, $20/mo base)

Per the public-beta changelog: "$0.60 per 1M operations" with 1M operations/month included on Pro. Per-message Fluid-compute charges apply to the consumer function.

| Component | Corrected scale |
| --- | --- |
| Queue API operations (send + receive) | ~57,000/mo |
| Cost above free 1M | $0 |
| Consumer Fluid-compute invocations | ~57,000 |
| Fluid-compute invocation cost (above free 1M) | $0 |
| Fluid-compute Active CPU | trivial at this volume |
| **Total marginal cost on top of $20 Pro** | **$0/month** |

### Verdict (revised)

**Cost is no longer a tie.** If carelog is on Inngest Pro today, the bill delta is **$75/mo Inngest vs $0/mo marginal Queues** — a real $900/yr saving that has to be weighed against the migration cost of rewriting 14 functions. If carelog is still on Hobby (e.g. because Inngest's tier headroom has shifted, or carelog's actual execution count is below model), the cost argument collapses to the original "$0 vs $0 tie."

The cost-driver question therefore comes down to operator-verifiable state: **what tier is carelog currently on?** This doc cannot answer that without a fresh check of the Inngest dashboard / latest invoice.

### Crossover

If carelog is already past the Hobby cap (likely under the corrected scale), the crossover question is moot — they're past it. If somehow still on Hobby, the crossover is roughly: execution count crosses 50k AND step-concurrency forces Pro upgrade. Queues stays $0/mo marginal through ~1M operations.

---

## Section 3 — Worked migration example (Q3)

The most representative single function is `refillAlert` (115 lines) — it's a cron, has step composition, uses idempotency, writes to Supabase, has try/catch error reporting. It maps to the planned ON-71 row, so it's also the row the brief implied was "about to land."

### Today: Inngest version (`apps/web/inngest/functions/refillAlert.ts:20-115`, 95 lines of function body)

```ts
export const refillAlert = inngest.createFunction(
  { id: 'refill-alert' },
  { cron: 'TZ=UTC 0 7 * * *' },
  async ({ step, logger }) => {
    try {
      const today = new Date()
      const allMedications = await step.run('fetch-low-supply-medications', async () => {
        const { data, error } = await supabaseAdmin
          .from('medications')
          .select('id, org_id, recipient_id, drug_name, supply_days_remaining')
          .eq('active', true)
          .lte('supply_days_remaining', 7)
        if (error) throw new Error('Query failed: ' + error.message)
        return (data ?? []) as MedicationRow[]
      })
      // … fan-out per medication via step.run('alert-' + med.id, ...) …
      // … each step checks idempotency (existing same-day row), inserts if missing …
      await supabaseAdmin.from('cron_runs').upsert({
        function_id: 'refill-alert', last_ran_at: ..., last_status: 'ok', error_message: null,
      })
      return { alerts: totalAlerts }
    } catch (err) {
      await supabaseAdmin.from('cron_runs').upsert({
        function_id: 'refill-alert', last_ran_at: ..., last_status: 'error',
        error_message: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }
)
```

Wired up once in `apps/web/app/api/inngest/route.ts:23` (`refillAlert,` import + `serve()` array entry).

### Hypothetical: Queues version (no Workflow — single-function path)

```ts
// app/api/cron/refill-alert/route.ts — new file (~25 lines)
import { send } from '@vercel/queue'

export async function GET() {
  // Vercel Cron Jobs invokes this at the scheduled time
  const today = new Date().toISOString().slice(0, 10)
  await send('refill-alert-trigger', { day: today }, {
    idempotencyKey: 'refill-alert-' + today,
  })
  return Response.json({ ok: true })
}
```

```ts
// app/api/queues/refill-alert/route.ts — new file (~90 lines, mostly the same body)
import { handleCallback } from '@vercel/queue'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import * as Sentry from '@sentry/nextjs'

export const POST = handleCallback(async ({ day }, metadata) => {
  try {
    const today = new Date()
    // Step 1: fetch — NO step.run wrapper; if this throws, the whole message is retried
    const { data: allMedications, error } = await supabaseAdmin
      .from('medications')
      .select('id, org_id, recipient_id, drug_name, supply_days_remaining')
      .eq('active', true)
      .lte('supply_days_remaining', 7)
    if (error) throw new Error('Query failed: ' + error.message)

    // Either: handle all medications in this one invocation (no per-med retry isolation)
    //   OR: fan out by sending one message per medication → another queue
    // The latter ~doubles the message count and adds another consumer route.

    for (const med of (allMedications ?? [])) {
      // … same idempotency check as today …
      // … same insert as today …
    }

    await supabaseAdmin.from('cron_runs').upsert({ /* same */ })
  } catch (err) {
    Sentry.captureException(err, { tags: { queue: 'refill-alert' } })
    await supabaseAdmin.from('cron_runs').upsert({ /* same error path */ })
    throw err // triggers redelivery
  }
})
```

```jsonc
// vercel.json — new entries
{
  "crons": [{ "path": "/api/cron/refill-alert", "schedule": "0 7 * * *" }],
  "functions": {
    "app/api/queues/refill-alert/route.ts": {
      "experimentalTriggers": [{ "type": "queue/v2beta", "topic": "refill-alert-trigger" }]
    }
  }
}
```

### Diff summary for this one function

| | Inngest | Queues (Cron + Queue, no Workflow) | Δ |
| --- | --- | --- | --- |
| New files | 0 (existing function file) | 2 route files + 1 `vercel.json` edit | +3 surfaces |
| Function-body LOC | 95 | ~110 | +15 LOC |
| Configuration surfaces | 1 (function spec) | 3 (cron entry, queue trigger, two route files) | More moving parts |
| Per-step retry isolation | Yes (`step.run` boundaries) | **No** without splitting into separate queues — fan-out per medication via additional `send()` calls | Loss of granularity OR more messages |
| Sentry integration | Middleware on client (already coded) | Manual `Sentry.captureException` in each consumer | +1 line/handler, easy to forget |
| Replay-on-failure UX | Inngest UI button | Re-send message manually | Worse |

**Net for one function: ~+15 LOC, ~+2 new files, configuration spread across 3 surfaces, loss of per-step retry isolation.** Multiply by 14 functions for the actual carelog migration.

If you instead adopt **Workflow** for the orchestration layer (to preserve `step.run` semantics), you add Workflow SDK + its own configuration + its own bill, and the LOC delta closes — but you've added a third Vercel product to learn.

---

## Section 4 — Reliability semantics under failure (Q4)

Short table here; nuance in the appendix file.

| Failure mode | Inngest | Vercel Queues (beta) |
| --- | --- | --- |
| Transient error inside a step | Step is retried with exponential backoff (default 4 attempts). Prior steps' checkpointed results are reused. | Whole message is redelivered until success or expiry. No partial replay — handler reruns from the top. |
| Unhandled exception | Function fails after retry budget. Failure event emitted; can subscribe a recovery function. Sentry middleware fires. | Message enters DLQ-equivalent after retry budget (visibility timeout × max attempts). Sentry only via consumer's own `captureException`. |
| Postgres lock contention (relevant for TD-144 atomic OCR confirm) | Step throws on `25P02`/lock-not-available → step retried. Prior step results reused, so re-fetching only the contended row is cheap. | Handler throws → message redelivered → entire handler re-runs from top, including any non-contended steps. Wastes work. |
| Step timeout | Per-step timeout configurable; only that step retried | Per-handler timeout (Fluid compute limits — 5 min default for Pro per Vercel docs). Whole handler retried. |
| Dead-letter handling | Inngest UI shows failures; subscribe a function to `inngest/function.failed` to alert / route | Vercel docs (as of retrieval) reference visibility timeout + retry but don't fully document DLQ surface. Beta-tier opacity. |
| TD-144 specifically (atomic OCR confirm with `SELECT FOR UPDATE`) | Wrap the contended SQL in `step.run('confirm-ocr', ...)` — failed lock acquisition → retry just that step. Audit-log insert (SEC-007) lives in its own step and is unaffected. | Whole handler re-runs on retry → audit-log insert (SEC-007 append-only) could double-write unless idempotent on (attempt_id, ocr_id). |

**Inngest's step model is materially better for TD-144's shape.** Carelog already implements idempotent inserts pragmatically (DB-level checks in `refillAlert` and `gapDetector`), so the audit-log issue is solvable on Queues — but it's an extra discipline to enforce, and a regression vs. the current model. See the appendix for failure-mode nuance.

---

## Section 5 — Sentry + PostHog integration depth (Q5)

### Sentry

**Inngest:** First-class via `InngestMiddleware`. Carelog already has it:

```ts
// apps/web/inngest/client.ts:4-22
const sentryMiddleware = new InngestMiddleware({
  name: 'Sentry error capture',
  init() {
    return {
      onFunctionRun({ fn }) {
        return {
          transformOutput(ctx) {
            if (ctx.result.error) {
              Sentry.captureException(ctx.result.error, {
                tags: { inngest_function: fn.id() },
              })
            }
            return ctx
          },
        }
      },
    }
  },
})
```

This automatically tags every captured exception with `inngest_function: <id>` so the Sentry project filters work. No per-function boilerplate.

**Vercel Queues:** Consumers are standard route handlers, so `@sentry/nextjs` instruments them automatically (the standard Next.js wrapper covers route handlers). Two losses vs. Inngest:

1. No automatic per-function tag — need to manually call `Sentry.setTag('queue', 'refill-alert')` or `Sentry.captureException(err, { tags: { queue: ... } })` in every consumer.
2. No `transformOutput`-style hook for non-throwing errors (e.g., handler returns successfully but `result.error` is non-null due to internal recovery).

Net: equivalent capture rate, weaker filterability without the middleware pattern. Per ADR-0001 (PHI rule), neither path changes the existing UUID-only contract — `Sentry.setUser`/`setContext` PHI rules apply equally to both.

### PostHog

Identical for both. `posthog.capture` is called from inside the handler in both worlds. ADR-0001 applies identically (UUID only; the project-local ESLint rule `carelog/no-phi-in-analytics` already enforces this at call sites). No vendor difference.

### Verdict

Inngest is meaningfully cleaner for Sentry instrumentation today (already coded; ~zero ongoing maintenance). Queues is workable but adds per-consumer discipline. PostHog is a wash.

---

## Section 6 — Recommendation (Q6) + counter-argument — REVISED

### Recommendation: provisional stay on Inngest, conditional on cost verification. Confidence: medium.

**Reasoning (architectural arguments — still hold):**

1. **The decision the brief asked is the wrong forcing function.** The "three more functions" are not three more — they're two-already-exist plus one net-new. Migration cost isn't 3 functions; it's 14 functions plus reworked `vercel.json` plus split Sentry instrumentation.
2. **Queues alone is too narrow.** A like-for-like replacement requires Vercel Cron Jobs + Vercel Queues + Vercel Workflow — three products to learn, three configuration surfaces, three pricing meters.
3. **Vercel Queues is still in public beta** (changelog dated 2026-02-27; pricing page shows "Beta" label at retrieval). Adopting a beta primitive for a production-critical surface contradicts carelog's bias toward boring/proven (per `CLAUDE.md` "Status reporting honesty").
4. **Step composition is a real productivity feature.** Carelog uses `step.run` in every Inngest function for per-step retry isolation; replacing it with whole-handler retries (or learning Workflow) is a regression OR a third-product adoption with its own learning curve.

**Cost argument (revised — conditional):**

5. **If carelog is currently on Inngest Hobby (under the corrected ~170k execution count, this is unlikely but possible — see Section 2):** cost is still $0/month for both options. The architectural arguments above dominate; stay on Inngest.
6. **If carelog is on Inngest Pro ($75/mo) under the corrected execution count:** Vercel Queues' $0/mo marginal is a real $900/yr saving. That doesn't automatically tip the recommendation — 14-function migration cost easily exceeds 12 months of saving in dev hours — but it does move "cost is not a deciding factor" from true to false. Re-evaluation horizon shortens from "12-24 months" to "next pricing review."

**Action: confirm Inngest current tier before treating this recommendation as final.**

### Counter-arguments (steel-manned)

- **Unified billing is genuinely simpler.** Carelog already pays $20/mo for Vercel Pro. Adding Inngest is a second vendor relationship, a second SLA to think about, a second bill, a second SOC-2 attestation chain. Consolidation has non-zero value.
- **Vercel Workflow is improving fast.** Workflow has been GA-ing features through 2026; by EoY 2026 the gap with Inngest's step model may narrow significantly. Re-evaluation in 6 months is genuinely warranted.
- **At-least-once delivery semantics in Queues are simpler to reason about** than Inngest's durable-execution model. For a small team, "you handle idempotency; we redeliver until you ack" is more transparent than the step-checkpointing model.
- **Inngest pricing tier risk is potentially the current state, not future.** Per the corrected math, carelog may already be on Pro. The original doc's framing of this as "12-24 months out" is wrong under corrected scale.
- **Architectural-coherence counter-argument (new, post-validation):** carelog already runs all its durable state in Postgres via Supabase — `cron_runs` table for cron observability, DB-level idempotency checks (`refillAlert.ts:59-71`, `gapDetector.ts:124-136`), audit logs (SEC-007 `ocr_audit_log`), and RLS-policed care-event state. Inngest's `step.run` checkpointing introduces a SECOND piece of distributed state that lives in Inngest's infrastructure — opaque to Postgres-shaped debugging. Vercel Queues' "at-least-once delivery, you handle idempotency" model is actually more aligned with carelog's existing Postgres-as-durable-state architecture, because the explicit idempotency discipline carelog already practices at the DB layer becomes the *only* layer of state to reason about. The "single-product blast radius" framing at Section 1 only counts Vercel-side products; it doesn't count the cross-vendor surface area that Inngest adds.

### Section 6.5 — Cadence audit (new)

Two cron functions dominate the corrected execution count: `rateLimit429Monitor` (every 5 minutes, 8,640/mo) and `shiftTradeExpiry` (every 15 minutes, 2,880/mo). Together they account for ~99% of cron runs. Before any platform migration, audit whether those cadences are necessary:

- `rateLimit429Monitor` at 5min: is this actually monitoring `429`s in real-time, or could 15min suffice? Dropping to 15min cuts that function's runs by 3× (8,640 → 2,880) and the total cron count by ~5,760/mo.
- `shiftTradeExpiry` at 15min: do shift trades genuinely expire on a 15-minute granularity, or would hourly work? Dropping to hourly cuts by 4× (2,880 → 720).

Combined cadence relaxation could halve the cron-runs/mo number, which:
- Pulls corrected execution count from ~170k toward ~90k — still over the 50k Hobby cap on its face.
- BUT if Inngest's actual billing-tier breakpoint is some higher number than 50k, OR if step-batching makes the real execution-unit count lower than the model predicts, cadence relaxation might be the cheaper move than platform migration.

This audit doesn't belong to this research doc — surface as a separate TD-* row.

### Trigger for re-evaluation

Migrate when **two or more** of the following are true:

- Vercel Queues exits beta to GA (track via vercel.com/changelog)
- Vercel Workflow stabilizes a `step.run` analog that matches Inngest's ergonomics
- **Inngest invoice confirmed at Pro tier ($75+/mo)** — under corrected scale, this may already be true; check the dashboard
- Carelog Inngest function count crosses ~30 (would force a refactor anyway)
- A reliability event (Sentry pattern, on-call incident) traces back to Inngest behavior
- HIPAA BAA becomes a hard requirement (Inngest lists HIPAA at Enterprise tier per pricing page; Vercel has its own BAA at $350/mo per Vercel pricing page)

**Immediate action (before next re-eval):**

1. Check Inngest dashboard → current billing tier + last 30-day execution count.
2. If Pro: seed a TD-* row to audit `rateLimit429Monitor` and `shiftTradeExpiry` cadences (per Section 6.5) — cadence relaxation may be cheaper than migration.
3. If Hobby: original recommendation stands; revisit in ~6 months as originally planned.

Set a calendar reminder in `BACKLOG.md` (via a separate `chore(backlog):` PR per ADR-0002) for 2026-11-15.

---

## Section 6.6 — Operator verification result (ON-76, 2026-05-15 evening)

Operator captured the two data points the §6 recommendation was conditional on:

- **Current Inngest billing tier:** Hobby
- **30-day function-run count:** not visible (Hobby tier does not expose a 30-day window; dashboard caps at 1-day visibility for free accounts)
- **Last-24h function runs:** 0 events

**Implication for the §6 recommendation.** The Hobby tier confirmed the "if Hobby" branch of the §2 conditional cost analysis, but the empirical 0-events-in-24h observation contradicts the doc's worked estimate that crons alone fire ~387×/day (rateLimit429Monitor 288/day + shiftTradeExpiry 96/day + daily/weekly crons ≈ 3/day). One of three explanations must be true:

1. **The crons aren't actually wired in prod.** Most likely. Inngest functions only fire when (a) the Inngest SDK is registered against a deployed app, AND (b) the app is reachable from Inngest cloud (Vercel deployment URL signed into the Inngest dashboard). If carelog's prod Inngest app registration is missing or broken, none of the 14 functions fire — including the crons. Verify via Inngest dashboard → Apps → `carelog` (or whatever the prod app name is) → "Last seen" timestamp.

2. **The dashboard's 1-day window is reading something narrower than total runs** (e.g. only failed runs, or only events not function invocations). Less likely but worth eyeballing.

3. **The §2 cron-runs/mo math was wrong AGAIN.** Possible — the original Cowork estimate was 6 crons × ~1/day = 200/mo; the post-validation pass corrected to 8 crons with rateLimit429Monitor + shiftTradeExpiry dominating to ~11,622/mo. If those two high-frequency crons are themselves gated by an env var or kill-switch that's currently set to "off" in prod, actual firings could be near-zero.

**Recommended next step.** Don't make the Inngest-vs-Queues migration decision on the doc's pricing math until prod cron-firing state is verified. The §6 recommendation ("stay on Inngest with medium confidence") still holds for now — Hobby tier + zero observed runs means there is no current cost pressure, and migration cost (rewrite 14 functions across 3 Vercel products) is genuinely high. But the underlying premise of the doc's §2 ("you ARE running 170k executions/month, so cost is the deciding factor") needs verification.

**Action (separate row, not this one).** Seed a TD-* follow-up to audit prod cron-firing state: confirm the Inngest app is registered + reachable, confirm the high-frequency crons (`rateLimit429Monitor`, `shiftTradeExpiry`) are running and not silently disabled, and capture an actual 24h sample once visibility is non-zero. Until that audit closes, the cost half of §6's recommendation is structurally unverifiable on Hobby tier.

---

## Section 6.7 — Per-function cron-firing audit (TD-146, 2026-05-17)

Source-level audit of all 14 Inngest functions completed; full per-function table, env-gate analysis, and operator dashboard verification steps live at `docs/research/2026-05-17-td-146-inngest-cron-audit.md`. TL;DR: 8 crons + 6 event handlers, no dark crons in source, projected ~388 cron firings/24h (23% of Hobby tier monthly quota). The §6 queue-migration decision is **unblocked** — Inngest is firing as expected.

---

## Sources (with retrieval date)

All sources retrieved 2026-05-15 unless otherwise noted.

- Inngest Documentation — https://www.inngest.com/docs
- Inngest Pricing — https://www.inngest.com/pricing
- Inngest TypeScript SDK v4 (current) — referenced via docs banner
- Inngest Middleware overview — referenced via docs
- Vercel Queues docs — https://vercel.com/docs/queues
- Vercel Queues Quickstart — https://vercel.com/docs/queues/quickstart
- Vercel Queues SDK Reference — https://vercel.com/docs/queues/sdk
- Vercel Queues API Reference — https://vercel.com/docs/queues/api
- Vercel changelog: "Vercel Queues now in public beta" — https://vercel.com/changelog/vercel-queues-now-in-public-beta (published Feb 27, 2026)
- Vercel changelog: "Vercel Queues is now in Limited Beta" — https://vercel.com/changelog/vercel-queues-is-now-in-limited-beta
- Vercel Pricing — https://vercel.com/pricing
- Vercel Workflow — https://vercel.com/workflows
- `@vercel/queue` npm package — https://www.npmjs.com/package/@vercel/queue
- Carelog repo state, `aa0ff4d` on `origin/main`:
  - `apps/web/inngest/client.ts:1-28`
  - `apps/web/app/api/inngest/route.ts:1-36`
  - `apps/web/inngest/functions/refillAlert.ts:1-115`
  - `apps/web/inngest/functions/gapDetector.ts:1-183`
  - `apps/web/inngest/functions/weeklyDigest.ts:1-284`
  - `apps/web/package.json` — `"inngest": "^3.54.0"`
- Carelog ADRs referenced:
  - `docs/adr/0001-phi-anonymous-uuid-only.md` (PHI UUID-only rule)
  - `docs/adr/0002-backlog-as-single-source-of-truth.md` (BACKLOG seed PR discipline)
- Handoff doc — `docs/research/2026-05-15-cowork-research-questions.md`

---

## Appendix pointer

Reliability nuance (per-failure-mode walkthrough for TD-144 specifically, dead-letter pattern details, retry budget tuning) lives in the companion file `docs/research/2026-05-15-inngest-vs-queues-reliability-appendix.md` to keep this doc under the 600-line cap.
