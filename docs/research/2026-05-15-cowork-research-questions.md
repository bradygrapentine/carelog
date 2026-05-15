# Cowork research-question doc — 2026-05-15

Hand-off doc for a remote Cowork research session. Carelog context + a primary research question + 2 alternates. Cowork agent has time budget to read external docs deeply and synthesize; pick the question whose answer is most decision-blocking right now.

---

## Carelog context the Cowork agent needs upfront

- **Product:** family caregiving coordination platform, $14/mo bootstrapped, Next.js 16 + tRPC + Supabase + Inngest + Vercel.
- **Repo:** `bradygrapentine/carelog` on GitHub. Monorepo: `apps/web` (Next.js), `apps/mobile` (Expo SDK 55), `packages/`, `supabase/`.
- **Hard invariant — ADR-0001 PHI rule:** `posthog.identify` / `posthog.capture` / `Sentry.setUser` / `Sentry.setContext` use anonymous UUID only. Never email, name, phone, dob, address, recipient identity. Lint rule `carelog/no-phi-in-analytics` enforces forbidden keys at call sites but doesn't catch spreads / variable refs. Sentry Replay is intentionally off (`apps/web/sentry.client.config.ts:22-24`).
- **Backlog discipline — ADR-0002:** `BACKLOG.md` is single source of truth. Feature/fix PRs do NOT touch BACKLOG.md. New TD/ON rows are seeded in dedicated `chore(backlog):` PRs.
- **Recently shipped (last 7 sprints, 2026-05-15):**
  - SEC-007 — OCR confirm append-only audit log (PR #531)
  - TD-145 — `scripts/migration-lint.sh` whitelist for same-file new-table indexes (PR #533)
  - TD-143 — `MOOD_LABELS` + `MOOD_KEYS` dedup, digest-tone override preserved (PR #535)
  - TD-120 / TD-129 — careteam RLS defense-in-depth + REVOKE accept_invite (PRs #522/#523)
  - UX-049 / UX-050 — auth/onboarding/journal copy pass, `"Crisis"` → `"Hard"` mood rename
  - TD-139 / TD-140 — PDF export note/notes fallback + memberships test filter-contract assertions
  - UX-041/042/043 — journal & meds quick-win trio
- **Currently parked, decision-needed:**
  - **TD-141** — `JournalPayload` has parallel `text` / `note` / `notes` slots with 3 different precedence policies across the codebase. Needs schema migration to single `body` column + ADR for precedence. Half-day.
  - **TD-142** — TS `acceptInvite` (with documented atomicity hole at `apps/web/server/repositories/membershipsRepository.ts:182-185`) vs SQL `accept_invite(text, uuid, text)` function (introduced in `supabase/migrations/20260407_atomic_invite_accept.sql`, REVOKEd by `20260516000000_revoke_accept_invite_from_anon_authenticated.sql`). Decision: collapse to one. Path (a) = flip TS to `supabaseAdmin.rpc('accept_invite', ...)` and delete TS body. Path (b) = drop SQL function. Path (a) gains atomicity; (b) loses a defense layer.
  - **TD-144** — Atomic OCR confirm via `SECURITY DEFINER` RPC + `SELECT FOR UPDATE`. SEC-007 records per-attempt audit (intentional, forensics-correct) but the underlying medication-insert + status-update race remains. Same shape as TD-142 in some ways.
  - **SEC-008** — Rotate existing 128/192-bit `share_token` values to 256-bit (in `outer_circle_requests` + `care_briefs`), plus a Resend email notifying outer-circle requesters their old link is invalidated. User-visible link invalidation is the risk.
  - **ON-70 / ON-71 / ON-74** — Phase 2/3/4 features: coverage_windows table + gap detector; refill-alerts Inngest job (`supply_days_remaining ≤ 7` nightly); full-history PDF/structured export.
- **Tech stack specifics worth noting:**
  - Inngest in use today: OCR pipeline (stubs), weekly digest cron infra. Local dev: `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`.
  - Stripe webhook wired (signature verification confirmed in 2026-05-14 OWASP audit).
  - Resend for transactional email; key gated by `RESEND_API_KEY` (graceful skip when unset).
  - PostHog for product analytics (with PHI gate).
  - Sentry for errors + traces (Replay disabled).
  - Vercel for hosting + Preview deployments. AI Gateway / Queues / BotID not currently adopted.
  - Supabase Postgres 15 with RLS on every PHI table; pgTAP coverage required for new RLS.

---

## Primary research question

### **"Should carelog migrate Inngest jobs to Vercel Queues, or stay on Inngest? Produce a decision matrix with a recommendation."**

#### Why this matters now

ON-71 (refill alerts), TD-133 (ai_conversations archival), and ON-70 (coverage gap detector) are all queued Phase 2/3 work that will run as scheduled / event-driven background jobs. Today carelog uses Inngest. Vercel Queues went GA in 2025 with native durability + at-least-once delivery. Deciding now — before three more Inngest functions land — is cheaper than retrofitting later. Also relevant: Vercel-native unified billing vs Inngest's own pricing tier.

#### Sub-questions (numbered for traceability in the deliverable)

1. **Feature parity.** For each capability carelog actually uses or has planned, does Vercel Queues match Inngest?
   - Cron-style scheduling (Inngest's `inngest.createFunction` with `cron: "..."`)
   - Event-driven trigger from HTTP body / supabase webhook / Stripe webhook
   - Idempotency keys (Inngest has them; what's Queues' equivalent?)
   - Step composition (`step.run`, `step.sleep`, `step.waitForEvent`)
   - Local dev workflow (Inngest CLI vs `vercel dev` integration)
   - Fan-out / batching primitives
   - Visibility / introspection (Inngest UI vs Vercel Observability dashboards)
2. **Pricing comparison** at carelog's expected scale: ~5 scheduled jobs running daily/weekly + ~500 event-driven invocations/day (modest; bootstrapped product). Include the breakeven point where each option wins.
3. **Migration cost** for an existing Inngest function. Take one of carelog's actual functions as a worked example and sketch the diff (read its source from the repo via GitHub MCP — `apps/web/inngest/functions/*` or `apps/web/app/api/inngest/route.ts`).
4. **Reliability semantics.** Both claim durability; what are the actual failure modes? Specifically: what happens if a step throws between retries? What's the dead-letter pattern? How does each handle a Postgres lock contention scenario (relevant for TD-144 atomic OCR confirm if implemented as a queued job)?
5. **Sentry / PostHog integration.** Carelog instruments errors and analytics. Which has better out-of-box instrumentation? Cite docs.
6. **One concrete recommendation** based on the above. Either: "stay on Inngest because X / Y / Z" or "migrate to Queues, sequenced after [trigger event]". Acknowledge confidence level + the strongest counter-argument.

#### Connectors to use

- **GitHub MCP** — read `apps/web/inngest/functions/*`, `apps/web/app/api/inngest/route.ts`, `package.json` (Inngest version), and any existing Inngest step code to ground the migration-diff sketch.
- **Vercel MCP** — confirm current project plan tier (Pro/Hobby/Enterprise) since Queues pricing varies by tier; check existing env vars for Inngest signing keys.
- **Context7 MCP** — resolve docs for `inngest` (latest) and `vercel/queues` (latest), pull current API surfaces verbatim.
- **WebFetch** — `https://vercel.com/docs/queues`, `https://www.inngest.com/docs`, pricing pages for both. Cross-check claims.
- **Sentry MCP** — check carelog's Sentry project for any Inngest-tagged events to understand current observability gaps.

#### Deliverable

`docs/research/2026-05-15-inngest-vs-queues.md` written into the repo on a branch `research/inngest-vs-queues-2026-05-15`, opened as a draft PR for review. Sections:

1. TL;DR (≤3 sentences with the recommendation)
2. Feature parity matrix (table; carelog rows highlighted)
3. Pricing breakeven analysis (with assumed-scale call-volume numbers)
4. Migration-cost worked example (the one Inngest function diff)
5. Reliability + observability section
6. Recommendation with confidence level
7. Sources (linked, with retrieval date)

Cap at 600 lines. If sub-question 4 (reliability) requires more than ~150 lines of nuance, split it into a companion appendix file rather than ballooning the main doc.

---

## Alternate research questions (lower priority but Cowork-worthy)

### Alt-A — "Production-grade atomic-operation patterns on Supabase for TD-142 + TD-144"

Both rows want atomicity. Compare:
- PL/pgSQL `SECURITY DEFINER` function (carelog's current path for `accept_invite`)
- Supabase Edge Function (Deno runtime)
- `supabase-js` transaction via PostgREST + `set_config('request.jwt.claim', ...)`
- Raw Postgres `BEGIN; ... COMMIT;` via a server-only DB client

Carelog-specific tradeoffs for each path, with worked TD-142 + TD-144 implementation sketches. Deliverable: `docs/research/2026-05-15-supabase-atomic-patterns.md`. Smaller scope than the primary (~300 lines).

Connectors: GitHub MCP (read the two existing code paths at `membershipsRepository.ts:163-200` and `app/api/ocr/confirm/route.ts`), Context7 (Supabase + PostgREST docs), supabase-local MCP (test pgTAP for each pattern against the live schema if useful).

### Alt-B — "Vercel AI Gateway adoption plan for carelog's AI-touching surfaces"

Carelog uses Anthropic for brief generation and (in future) OCR. AI Gateway gives provider portability, unified billing, observability, fallbacks. Worth the integration cost? At carelog's scale (single Anthropic provider today, low volume), maybe not. Sub-questions:
- Which carelog call sites currently invoke an LLM directly?
- What does the migration diff look like for each?
- Cost delta (Gateway adds latency + a 0% markup baseline; verify)
- Observability gain — what does carelog get that Sentry doesn't already give?
- Is there a "thin Gateway adoption" path (route only NEW LLM features through Gateway, keep existing direct)?

Deliverable: `docs/research/2026-05-15-vercel-ai-gateway-adoption.md`, ~400 lines. Connectors: GitHub MCP (grep for `@ai-sdk/anthropic`, `Anthropic(`, `claude-`), Context7 (Vercel AI Gateway + AI SDK v6 docs), Vercel MCP (project AI Gateway availability).

---

## Out of scope for any Cowork session

- Writing production code (Cowork is research-only here). Recommendations land as `docs/research/` markdown + maybe a `BACKLOG.md` row seed.
- Modifying `BACKLOG.md` directly — per ADR-0002, follow-up rows go in dedicated `chore(backlog):` PRs, not bundled with research outputs.
- Touching `.claude/` (Cowork is not the harness layer).
- Long-running deployment / migration experiments against staging — flag those back to the operator with a runbook instead.
- Any work that requires `Sentry.captureException` / `posthog.capture` instrumentation in production code (write the recommendation, don't ship it).

---

## How the operator (Brady) sets up the Cowork session

1. Point Cowork at this repo's main branch.
2. Hand it this file path: `docs/research/2026-05-15-cowork-research-questions.md`.
3. Specify which research question to pursue (primary / Alt-A / Alt-B).
4. Confirm Cowork has GitHub MCP + Context7 + WebFetch at minimum. Vercel / Sentry / PostHog / supabase-local MCPs are nice-to-have but the primary deliverable can be produced without them — the agent should flag any blocker on connector availability rather than guess.
5. Time budget guidance: primary should take ~2 hr of agent time; Alt-A ~1 hr; Alt-B ~1.5 hr.
