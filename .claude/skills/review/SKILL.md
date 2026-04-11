# Adversarial Security Review — Carelog

**READ-ONLY. Do NOT edit any files. Do NOT make implementation changes.**
Output a findings report. Stop. Wait for explicit instructions before fixing anything.

## Execution Strategy

Dispatch **3 parallel subagents** using the Agent tool. Each reviews a different attack surface. After all complete, synthesize a prioritized summary.

### Agent 1: Auth + RLS
- `supabase/migrations/` — RLS policies, SECURITY DEFINER functions
- `apps/web/app/(app)/layout.tsx` — server auth guard
- `apps/web/lib/supabaseServer.ts` — auth helpers
- `apps/web/server/` — supabaseAdmin usage (must only be in `server/` and `app/api/`)
- tRPC procedures: all must use `protectedProcedure`

Focus: Can user A access user B's data? Can a supporter perform coordinator actions? Is `supabaseAdmin` ever imported client-side?

### Agent 2: Input Validation + API Routes
- `apps/web/app/api/` — every route handler
- `packages/schemas/src/` — Zod schemas
- `apps/web/lib/rateLimit.ts` — coverage check

Focus: Does every API route call `getRequestUser()` + return 401? Does every route call `rateLimit()`? Are request bodies validated with Zod before use?

### Agent 3: Data Leakage + PHI
- `apps/web/inngest/` — background jobs (emails, digests)
- Sentry/PostHog configs — `sendDefaultPii: false`? No email in `posthog.identify()`?
- `care_events.payload` — real names, DOB, contact info never in jsonb payload
- `identity_vault` — never queried with anon/authenticated role

Focus: Could PHI leak to Sentry, PostHog, email HTML, or client-side code?

All 3 agents MUST be dispatched in a single message (parallel execution).

---

## Carelog-Specific Attack Surface

### IDOR via org_id / recipient_id
- Every API route accepting `org_id` or `recipient_id` must verify caller membership BEFORE reading data.
- `supabaseAdmin` bypasses RLS — explicit membership checks required.

### Service Role Key Boundary
- `supabaseAdmin` must only appear in `apps/web/server/` and `apps/web/app/api/`.
- `SUPABASE_SERVICE_ROLE_KEY` must never be prefixed `NEXT_PUBLIC_`.

### Invite Token Integrity
- Token consumption must be atomic (no TOCTOU window).
- `expires_at` checked server-side, not just client-side.
- `email` on token matches accepting user's email.

### Rate Limit Coverage
- Every `app/api/` route must call `rateLimit(request, 'key')`.
- `rateLimit` must no-op when Upstash env vars are absent.

### RLS Policy Correctness
- Policies use scalar boolean functions, not set-returning (see ENTERPRISE_PRINCIPLES.md #9).
- `identity_vault` policy returns 0 rows for `authenticated` role.

---

## Output Format

```
## Critical
- [file:line] Description — attack vector — recommended fix

## High
- [file:line] Description — attack vector — recommended fix

## Medium
- [file:line] Description

## Low / Info
- [file:line] Description

## Clean
- Areas with no findings
```

Do NOT make any edits. Do NOT propose code. List findings only.
After outputting the report, stop and wait.
