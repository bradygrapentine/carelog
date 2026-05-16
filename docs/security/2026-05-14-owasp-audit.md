# OWASP Full-Project Security Audit — Carelog

**Date:** 2026-05-14
**Auditor:** Read-only review, no fixes applied
**Scope:** apps/web (Next.js 16 + tRPC + Supabase), apps/mobile (Expo SDK 55 + tRPC), supabase/ (migrations + RLS + pgTAP), server/ (admin), inngest/ jobs, Stripe webhook, OCR pipeline, AI/brief generation
**Framework coverage:** OWASP Top 10:2025 · OWASP LLM Top 10 (2025) · ASVS 5.0 baseline · TypeScript / Next.js 16 / Supabase RLS footguns
**Method:** Tool pass (gitleaks/semgrep not installed locally; CI runs OSV Scanner + Gitleaks + Trivy + Dep audit on every PR, all passing) → manual file:line walk → severity classification

This report is **READ-ONLY**. No code edits applied. Next step: triage into BACKLOG.md as `SEC-*` / `TD-*` rows, then plan sprint chunks.

## Executive summary

Carelog's security posture is generally strong: every production table has RLS enabled, every webhook is signature-verified, the PHI invariant (ADR-0001) is enforced by both convention and an ESLint rule (TD-117), and the OOP refactor wave just hardened OCR concurrency (OOP-004), invite-token atomicity (OOP-001), `journal_reactions` RLS (OOP-002), and `care_briefs.recipient_id` immutability (OOP-008). No critical vulnerabilities found.

The findings below are mostly defense-in-depth gaps rather than open holes:

- **1 High** — Stripe webhook handlers lack event-ID deduplication. Stripe's at-least-once delivery means a network retry will re-process the same event with side effects.
- **3 Medium** — Brief share endpoint missing rate limit; OCR pipeline stubs lack input-sanitization scaffolding for when a real provider is wired; AI router relies on instruction-following (system prompt rules) without observability/audit of when those rules slip.
- **4 Low/Info** — Inconsistent share-token entropy across surfaces; AI panel rendering invariant undocumented (future markdown rendering would re-open XSS); a few minor items.

The codebase has zero `eval`/`Function()`/`child_process`/`execSync`/`spawn` usage in app code. `dangerouslySetInnerHTML` appears only for static JSON-LD SEO blocks (no user input). Service-role key isolation holds — `supabaseAdmin` is only imported from `.server.ts` modules.

## Findings — Critical

(none)

## Findings — High

### FIND-001 — Stripe webhook lacks event-ID deduplication

- **Severity:** High (CVSS ~7.5)
- **Files:** `apps/web/app/api/stripe/webhook/route.ts`, all 4 handlers in `apps/web/app/api/stripe/webhook/handlers/{checkoutSessionCompleted,customerSubscriptionUpdated,customerSubscriptionDeleted,invoicePaymentFailed}.ts`
- **Category:** OWASP A06 (Insecure Design — replay protection) · A01 adjacent (broken business-logic control)
- **Impact:** Stripe documents that webhook delivery is at-least-once and events WILL be retried on transient failure (network glitch, function timeout, 5xx response). With no deduplication layer, a replayed `checkout.session.completed` re-runs the subscription-grant logic; a replayed `customer.subscription.deleted` could grief-revoke an already-restored subscription; replayed `invoice.payment_failed` sends duplicate emails. Signature verification at `route.ts:13` confirms authenticity but does not prevent legitimate replays.
- **Suggested fix shape:** add a `stripe_events (event_id text primary key, processed_at timestamptz)` table; before dispatching to a handler, attempt an `INSERT ... ON CONFLICT DO NOTHING` keyed on `event.id` and short-circuit (200 OK) if the row already existed. Cap dispatcher at the unique-insert boundary; handlers stay otherwise unchanged. Companion pgTAP test asserts a duplicate event_id is a no-op.
- **Refs:** CWE-294 (Authentication Bypass by Capture-Replay), Stripe webhook docs §"Best practices", OWASP A06:2025.

## Findings — Medium

### FIND-002 — Brief share GET endpoint missing rate limit

- **Severity:** Medium (CVSS ~5.3)
- **File:** `apps/web/app/api/brief/[shareToken]/route.ts:5-50` (no `rateLimit(...)` call)
- **Comparison:** the sibling revoke endpoint at `apps/web/app/api/brief/[shareToken]/revoke/route.ts:10` is rate-limited; the GET fetch is not.
- **Category:** OWASP A04 (Cryptographic Failures — rate-limit on token lookups) · A06 (Insecure Design)
- **Impact:** `share_token` is 192-bit (`gen_random_bytes(24)` per `supabase/migrations/20260327234330_core_schema.sql:628`), which is cryptographically strong against guessing. However, no rate limit enables: (a) abuse for content scraping if a token leaks (e.g., shared in a misaddressed email), (b) higher signal for timing oracles on token-prefix matching at the index level, (c) cheap DoS against the endpoint. ASVS V11.1.4 mandates rate limits on token-lookup endpoints.
- **Suggested fix shape:** add `await rateLimit(request, "brief/share")` at the top of the GET handler, before the database query. Match the existing pattern in revoke/route.ts. Consider a separate budget for cache-busting GETs.
- **Refs:** OWASP A04:2025, ASVS V11.1.4.

### FIND-003 — OCR pipeline lacks input-sanitization scaffold for the future LLM provider

- **Severity:** Medium (CVSS ~5.0 — risk realized only when OCR_API_KEY is set)
- **Files:** `apps/web/inngest/functions/ocrPrescription.ts:55-58`, `apps/web/inngest/functions/ocrDocument.ts:118` (and the broader `extractFields`/`parseOcrText` regex parsers)
- **Category:** OWASP LLM01 (Prompt Injection — pre-realized) · LLM05 (Improper Output Handling — pre-realized)
- **Impact:** Both Inngest functions contain the line `if (!apiKey || !job) return "Lisinopril 10mg\nTake once daily with water"` followed by `// Real OCR call would go here — returns raw text`. They are stubbed today, but the eventual real OCR/vision-LLM call will:
  1. Pass document images (uploaded by users — untrusted) to an LLM provider.
  2. Return raw text that is currently regex-parsed via `parseOcrText` and written into `ocr_jobs.parsed_payload` jsonb.
  3. Get reviewed by the user via the existing OCR review UI, then optionally inserted as a `medications` row.
  The parser is regex-only (no LLM-call output handling, no allowlist on extracted fields, no input-length cap on the raw text before insertion). When a real provider is wired, an attacker could upload an image containing crafted text designed to: (a) inject misleading drug names that pass review, (b) generate excessively long output to bloat the row, (c) embed prompt-injection content if a downstream LLM later summarizes the ocr_jobs table.
- **Suggested fix shape:** before wiring a real OCR provider — add (1) raw-text length cap (e.g., 8KB) before regex parse, (2) explicit allowlist on `drug_name` characters (alphanumeric + space + hyphen + period), (3) audit-log every OCR confirm action with user_id + the LLM's raw output for post-incident traceability. Capture as a `SEC-OCR-*` row blocking the real-provider wiring story.
- **Refs:** OWASP LLM01:2025, LLM05:2025, CWE-20.

### FIND-004 — AI assistant relies on instruction-following for PHI redaction; no audit signal when it slips

- **Severity:** Medium (CVSS ~5.0)
- **Files:** `apps/web/server/routers/ai.ts:9-19` (`SYSTEM_PROMPT`), `apps/web/server/routers/ai.ts:140` (`deidentifyText` call), `apps/web/lib/ai-deidentify.ts:30` (`deidentifyText` implementation)
- **Category:** OWASP LLM02 (Sensitive Information Disclosure) · A01 (Broken Access Control — observability)
- **Impact:** Two defenses are in place: `deidentifyText(input.prompt, nameMap)` substitutes known names with placeholders before the prompt reaches Anthropic, and the system prompt instructs Claude to "never reproduce names". Both are best-effort:
  - `deidentifyText` only catches names present in `nameMap` (team members' display_names, recipient names). It does not redact PHI fragments in the user's prose (e.g., journal text quoted into the prompt, diminutives, misspellings, addresses, phone numbers, dates, dose values).
  - The system prompt instruction is followed by the LLM with high but not perfect probability.
  When a slip happens (model reproduces a name, leaks a quoted dose value into its response), today there's no signal — `ai_conversations.messages` is stored owner-readable, but no offline auditing job, no anomaly detection, no flag on the `$exception` events.
- **Suggested fix shape:** add an LLM-output post-filter that scans for any `nameMap` value reappearing in the response; if found, log to Sentry with redacted context + flip an `ai_phi_slip` PostHog event (UUID only per ADR-0001). Optionally a weekly Inngest job that samples `ai_conversations` rows and audits for known PHI patterns. Both are observability fixes; the underlying invariant is the system prompt rule, which is doing what it can.
- **Refs:** OWASP LLM02:2025, OWASP A09:2025 (Logging Failures — security events not surfaced).

## Findings — Low / Info

### FIND-005 — Inconsistent share-token entropy across surfaces

- **Severity:** Low (CVSS ~3.1)
- **Files:** `supabase/migrations/20260327234330_core_schema.sql`
  - `outer_circle_requests.share_token` — `gen_random_bytes(16)` = **128-bit**
  - `care_briefs.share_token` — `gen_random_bytes(24)` = **192-bit**
  - `invite_tokens.token` — `gen_random_bytes(32)` = **256-bit**
- **Category:** OWASP A04 (Cryptographic Failures — minor) · ASVS V6.4.2
- **Impact:** All three are well above the 64-bit guessability threshold (128-bit is the OWASP minimum for tokens), so this is not exploitable on its own. The risk is **consistency for future review**: a developer copying the outer_circle pattern to a new feature could land on 64-bit by accident. NIST SP 800-63 §5.1.1 recommends ≥128 bits and treats higher (256-bit) as defense-in-depth for long-lived tokens.
- **Suggested fix shape:** decide a single project-wide minimum (recommend 256-bit) and rewrite the outer_circle and care_briefs defaults to match. Or document the rationale per token type if the variance is intentional (e.g., outer_circle tokens may be deliberately short for shareability).
- **Refs:** OWASP A04:2025, ASVS V6.4.2, NIST SP 800-63 §5.1.1.

### FIND-006 — AI panel render invariant undocumented; future markdown rendering would re-open XSS

- **Severity:** Low (CVSS ~3.0 — preventive)
- **File:** `apps/web/components/ai/AIChatThread.tsx:60` — renders `{msg.content}` as JSX text node
- **Category:** OWASP LLM05 (Improper Output Handling) · A03 (Injection)
- **Impact:** Today, LLM output flows from `apps/web/server/routers/ai.ts:153` → `displayText` → `data.response` → `setMessages(..., content: data.response, ...)` → `{msg.content}` in AIChatThread. JSX text-child escaping makes this safe against XSS by construction. **But there is no documented invariant** that prevents a future contributor from adding markdown rendering, code-block syntax highlighting, or clickable-link auto-linking — any of which is a sink where unsanitized LLM output becomes a XSS vector.
- **Suggested fix shape:** add an inline `// SECURITY: LLM output rendered as JSX text — never wrap in dangerouslySetInnerHTML or any HTML/markdown renderer without sanitization. PHI/XSS invariant.` comment at `AIChatThread.tsx:60`. Pair with a custom ESLint rule (in `apps/web/eslint-rules/`) similar to TD-117's `no-phi-in-analytics` to forbid `dangerouslySetInnerHTML` and `react-markdown` imports inside AI components.
- **Refs:** OWASP LLM05:2025, OWASP A03:2025.

### FIND-007 — `ai_conversations.messages` row growth unbounded

- **Severity:** Low/Info (CVSS ~3.0)
- **File:** `supabase/migrations/20260422000001_ai_assistant.sql:7` — `messages jsonb[] NOT NULL DEFAULT '{}'`
- **Category:** OWASP LLM10 (Unbounded Consumption — storage)
- **Impact:** No row-size cap, no message-count cap. A long-running conversation can grow unboundedly until it hits Postgres' jsonb row size limit (~1GB), at which point inserts start failing. Pre-realized DoS surface.
- **Suggested fix shape:** at write site in `ai.ts`, cap the appended array to the last N messages (e.g., 50). Pair with a periodic Inngest job that archives or trims conversations older than 90 days.
- **Refs:** OWASP LLM10:2025.

### FIND-008 — `ai.ts` ACTION regex parse is forgiving (informational)

- **Severity:** Info
- **File:** `apps/web/server/routers/ai.ts:178-188`
- **Category:** OWASP LLM05 (Improper Output Handling)
- **Impact:** The `ACTION:` regex parses LLM output for an action proposal. The `description` portion (`actionMatch[2]`) is freeform text shown to the user. The `type` is allowlisted (`ALLOWED_ACTION_TYPES`). Even if the LLM is injected to suggest a malicious action description (e.g., "Click here to send all data to attacker.com"), the user has to click a UI element to act, and the action_type allowlist constrains what the click can do. Not a real vulnerability today — flagged because the parsing surface is asymmetric (strict on type, permissive on description) and worth noting if action descriptions ever become more than display strings.
- **Suggested fix shape:** none required today. If `description` ever flows into a tool call (e.g., LLM-suggests-then-executes pattern), add an allowlist on the description shape.
- **Refs:** OWASP LLM05:2025.

## Posture — what's well-defended

This audit produced fewer findings than expected because the project gets a lot right:

- **34 of 34 production tables have RLS enabled** (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every `CREATE TABLE` in the production migrations).
- **Service-role-key isolation holds.** `supabaseAdmin` is only imported from files matching `*.server.ts` or under `server/`. Next.js 16's RSC + the `.server.ts` filename convention prevent client-bundle leakage. (Server components like `apps/web/app/(app)/settings/history-export/page.tsx` use it correctly.)
- **Webhook signature verification is consistent.** Stripe at `route.ts:13` uses `webhooks.constructEvent(...)`. Inngest uses the SDK's `inngest/next` `serve()` which handles signature internally. The health crons endpoint uses a bearer-token from env (`HEALTH_CRONS_TOKEN`).
- **invite_tokens flow is now well-hardened** by OOP-001's pgTAP coverage (atomic accept, expiry, email-mismatch, already-used, concurrent-accept) + 256-bit entropy + service-role-only EXECUTE on `accept_invite()`.
- **PHI invariant (ADR-0001) is doubly-enforced** by convention and by `carelog/no-phi-in-analytics` ESLint rule (TD-117). Spot-checked posthog.capture call sites (invite, contact, signin, ocr, push, onboarding, dashboard) all pass UUID-only data; properties are either booleans (`email_sent: !!resend`), counts, or `org_id` UUIDs.
- **No code-execution sinks in app code.** Zero hits on `eval(`, `Function(`, `child_process`, `execSync`, `spawn(`, `vm.runInContext`.
- **No XSS sinks from user/LLM input.** `dangerouslySetInnerHTML` appears only for static `JSON.stringify(jsonLd)` in marketing pages. LLM output rendered via `{msg.content}` JSX text escape.
- **All authenticated tRPC procedures pass through `protectedProcedure` middleware** which throws `UNAUTHORIZED` if `ctx.user` is missing.
- **Auth surface is rate-limited.** `auth/verify` allows 30/15min (reasonable for OTP retries); `contact` is rate-limited with a 16KB body cap; `ocr/discard`, `ocr/confirm`, `ocr/save-fields` all rate-limited via `rateLimit(request, ...)`.
- **OOP refactor wave just hardened concurrency.** OCR job state machine (OOP-004) prevents the double-confirm race; `care_briefs.recipient_id` immutability trigger (OOP-008) prevents silent recipient binding changes; `journal_reactions` RLS (OOP-002) closed a recently-discovered silent-read gap.
- **40 pgTAP test files** under `supabase/tests/` exercise RLS policies and triggers in CI. The recent Wave A/B work added 4-arg `throws_ok` and `SET LOCAL ROLE service_role` discipline as load-bearing patterns.
- **AI input validation is strict.** Zod schema caps prompt to 2000 chars; `pageContext` is an allowlisted enum.
- **AI de-identification (best-effort) is in place** — `deidentifyText(prompt, nameMap)` substitutes known names with placeholders before the prompt reaches the LLM.

## Out of scope / deferred

- **Active penetration testing** — no authorization for live targets. CI's OSV Scanner + Gitleaks + Trivy + audit jobs cover the supply chain + secrets dimensions.
- **Container/IaC audit** — Vercel infrastructure not in scope; CI runs Trivy.
- **Mobile binary-level audit** — Expo managed workflow; surface examined via source.
- **Performance / DoS at the edge** — Vercel + Cloudflare handle these; out of /owasp scope.

## Findings index for backlog seeding

When triaging into BACKLOG.md (per BACKLOG-as-SoT in dedicated `chore(backlog):` PR), suggested row prefixes:

| Finding | Suggested row | Recommended prefix |
|---|---|---|
| FIND-001 Stripe idempotency | `Stripe webhook event-ID deduplication table` | `SEC-001` |
| FIND-002 Brief share rate limit | `Add rateLimit() to brief/[shareToken] GET` | `SEC-002` |
| FIND-003 OCR sanitization scaffold | `OCR input-sanitization scaffold before real-provider wire` | `SEC-003` (block real-provider story) |
| FIND-004 AI PHI slip observability | `AI output post-filter + Sentry signal on PHI slip` | `SEC-004` |
| FIND-005 Share-token entropy | `Normalize share-token entropy to 256-bit across all surfaces` | `SEC-005` |
| FIND-006 AI render invariant | `Inline comment + ESLint rule pinning AIChatThread render invariant` | `TD-131` |
| FIND-007 ai_conversations growth | `Cap messages jsonb[] length + archival job` | `TD-132` |
| FIND-008 ACTION regex | (no action — informational; revisit if `description` flows to tools) | n/a |

Plus the existing OOP follow-ups already in BACKLOG.md §1: TD-129 (service_role test discipline) and TD-130 (pdf typeof narrowing), plus OOP-015 PR2 (Stripe → Sentry routing — note that FIND-001's idempotency fix may want to sequence ahead of that since both touch the webhook).
