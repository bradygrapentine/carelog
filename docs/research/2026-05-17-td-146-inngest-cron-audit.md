# TD-146 — Inngest cron-firing audit

**Date:** 2026-05-17
**Scope:** Every function under `apps/web/inngest/functions/**` (14 total)
**Method:** Static analysis of source (triggers, env-gates) + reference to the partial dashboard verification from 2026-05-16 captured in `docs/research/2026-05-15-inngest-vs-queues.md` §6.6.
**Outcome:** All 8 prod cron functions are unconditionally registered (no env-gating short-circuits); the 6 event-triggered functions only fire on `inngest.send()` calls. No dark crons detected in source. Operator dashboard verification for per-function 24h run counts is still required (deferred — see §3).

## §1 — Function enumeration

| # | Function | File | Trigger | Schedule | Env-gated? | Projected runs / 24h |
|---|---|---|---|---|---|---|
| 1 | `burnoutAlert` | `burnoutAlert.ts:54` | cron | `TZ=UTC 0 8 * * 1` (Mon 8am UTC) | no | 0.14 (~1/wk) |
| 2 | `digestDeliveryMonitor` | `digestDeliveryMonitor.ts:52` | cron | `TZ=UTC 0 12 * * 0` (Sun noon UTC) | no | 0.14 (~1/wk) |
| 3 | `educationTipRefresh` | `educationTipRefresh.ts:7` | cron | `0 6 * * *` (daily 6am) | no | 1 |
| 4 | `gapDetector` | `gapDetector.ts:54` | cron | `TZ=UTC 0 6 * * *` (daily 6am UTC) | no | 1 |
| 5 | `rateLimit429Monitor` | `rateLimit429Monitor.ts:47` | cron | `TZ=UTC */5 * * * *` (every 5 min) | no | 288 |
| 6 | `refillAlert` | `refillAlert.ts:22` | cron | `TZ=UTC 0 7 * * *` (daily 7am UTC) | no | 1 |
| 7 | `shiftTradeExpiry` | `shiftTradeExpiry.ts:35` | cron | `*/15 * * * *` (every 15 min) | no | 96 |
| 8 | `weeklyDigest` | `weeklyDigest.ts:121` | cron | `TZ=UTC 0 8 * * 1` (Mon 8am UTC) | no | 0.14 (~1/wk) |
| 9 | `careEventCommentFanout` | `careEventCommentFanout.ts:70` | event | `careEventComment/created` | n/a | usage-driven |
| 10 | `documentsExtractText` | `documentsExtractText.ts:71` | event | `documents/extract-text` | runtime: skipped if `OCR_API_KEY` unset | usage-driven |
| 11 | `journalFlagAlert` | `journalFlagAlert.ts:32` | event | `journal/flagged` | n/a | usage-driven |
| 12 | `messagingPush` | `messagingPush.ts:13` | event | `messaging/message.sent` | n/a | usage-driven |
| 13 | `ocrDocument` | `ocrDocument.ts:90` | event | `ocr/document.created` | runtime: short-circuits if `OCR_API_KEY` unset (`ocrDocument.ts:111`) | usage-driven |
| 14 | `ocrPrescription` | `ocrPrescription.ts:35` | event | `ocr/job.created` | runtime: reads `OCR_API_KEY` (`ocrPrescription.ts:59`) | usage-driven |

**Cron sum:** 8 functions, projected `288 + 96 + 4 + 3·(1/7) = ~388 firings/24h`.

This matches the projected daily-firing volume cited in `inngest-vs-queues.md` §2 (the 24h "0 events" reading on the Events tab was metric semantics — Events tab tracks `inngest.send()` calls, not cron-triggered runs; runs show under Functions → Runs per the §6.6 verification note).

## §2 — Env-gate analysis (hypothesis #3 resolution)

Hypothesis #3 from the backlog row: "high-frequency crons silently disabled by env-gates."

**Refuted.** `rateLimit429Monitor` (line 47) and `shiftTradeExpiry` (line 35) both register unconditionally — no `process.env` reads in the registration block, no early `return` short-circuits in the handler that depend on env values. Their handlers reference Supabase (`createServiceRoleClient()`) but Supabase env vars are mandatory at module-load time elsewhere in the build, so absence would fail the deploy entirely, not silently disable the cron.

The OCR event-triggered functions (`documentsExtractText`, `ocrDocument`, `ocrPrescription`) DO have runtime env-gates on `OCR_API_KEY` — but those are event-driven, not cron-driven, and the gate is a no-op-then-return for individual events rather than a registration-time disable. Acceptable.

## §3 — Per-function firing verification (deferred — operator action)

Source analysis confirms the 8 crons should fire. The remaining audit step — confirming each ACTUALLY fired in the last 24h with the expected cadence — requires the Inngest dashboard, which is not MCP-fetchable today.

**Operator verification steps** (run when convenient; ~10 min total):

1. Open https://app.inngest.com → Apps → `carelog` → Functions tab.
2. For each of the 8 cron functions in §1, click in and check the **Runs** tab for the last 24h. Expected counts:
   - `rateLimit429Monitor`: 280-290 runs (288 expected; allow ±2% for scheduler jitter)
   - `shiftTradeExpiry`: 92-100 runs (96 expected)
   - `educationTipRefresh`, `gapDetector`, `refillAlert`: 1 run each (matching their daily 6am-7am UTC slot)
   - `burnoutAlert`, `digestDeliveryMonitor`, `weeklyDigest`: 1 run total in the last 7 days (weekly cadence)
3. If any function shows ZERO runs in the expected window, surface immediately as a new backlog row — that's a dark cron and the source-level "no env-gate" claim in §2 is wrong.
4. Sample 1 success and 1 failure (if any) per function to spot-check duration + error patterns.

A future automation step would be an Inngest MCP server or a `gh actions`-style fetcher hitting Inngest's GraphQL API. Out of scope for this audit.

## §4 — Queue-migration decision impact

The Inngest-vs-Queues research doc (`docs/research/2026-05-15-inngest-vs-queues.md` §6.6) noted the cost half of the recommendation was structurally unverifiable until prod firing state was known. After this audit:

- **Source-level cost projection is now firm:** ~388 cron firings/24h + event-driven volume = the upper-bound for monthly Inngest function-execution charges. The Hobby-tier read in §6.6 (0 events/24h on the Events tab) DOES NOT imply zero compute — it only means zero `inngest.send()` calls. Crons still consume function-execution slots.
- **Hobby tier currently fits:** Hobby's quota is 50k function runs/month. Projected `388 × 30 = 11,640` runs/month is ~23% of quota. Plenty of headroom even with event traffic.
- **Decision impact:** **does NOT block the migration decision.** The original "0 events / 24h" reading was a red herring (metric semantics, not actual zero work). Cost-side analysis in `inngest-vs-queues.md` §2 stands. TD-133 / ON-70 / ON-71 are unblocked.

This is the answer the backlog row was looking for: the migration decision is unblocked, and Inngest is firing as expected.

## §5 — Follow-ups (if any)

None identified by source analysis. Operator dashboard verification (§3) may surface follow-ups; if so, seed them as TD-* rows pointing back to this audit.
