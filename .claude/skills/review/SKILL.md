# Adversarial Security Review — Carelog

**READ-ONLY. Do NOT edit any files. Do NOT make implementation changes.**
Output a findings report. Stop. Wait for explicit instructions before fixing anything.

---

## Scope

Review in this order:
1. `apps/web/app/api/` — all API routes
2. `apps/web/lib/` — auth helpers, rate limiting, input parsing
3. `apps/web/server/` — tRPC routers, supabaseAdmin usage
4. `supabase/migrations/` — RLS policies, SECURITY DEFINER functions
5. `packages/schemas/src/` — Zod schemas

---

## Carelog-Specific Attack Surface

These are the real risks in this codebase — check these before generic OWASP:

### PHI Leakage
- `care_events.payload` is jsonb. Check that real names, DOB, contact info never appear in payload or API responses.
- `identity_vault` must never be queried with anything other than service role. Verify no `createServerSupabase()` (anon/authenticated role) touches it.
- Weekly digest and invite emails: verify no real names leak into email HTML via payload fields.

### IDOR via org_id / recipient_id
- Every API route that accepts `org_id` or `recipient_id` must verify the caller is a member of that org BEFORE reading data.
- `supabaseAdmin` bypasses RLS — explicit membership checks are required anywhere it's used.
- Check: can user A pass user B's `org_id` and get data?

### Service Role Key Boundary
- `supabaseAdmin` must only appear in `apps/web/server/` and `apps/web/app/api/`.
- Scan for any import of `supabaseAdmin` outside these directories.
- Check that `SUPABASE_SERVICE_ROLE_KEY` is never prefixed `NEXT_PUBLIC_`.

### Invite Token Integrity
- Token consumption must be atomic. Check `invite/[token]/accept/route.ts` — is there a TOCTOU window between "check consumed_at" and "set consumed_at"?
- Verify `expires_at` is checked server-side, not just client-side.
- Verify `email` on the token matches the accepting user's email.

### Rate Limit Coverage
- Check every `app/api/` route: does it call `rateLimit(request, 'key')`?
- Verify the `rateLimit` function no-ops gracefully when Upstash env vars are absent (local dev should not crash).

### Auth Guard Completeness
- Every API route must call `getRequestUser(request)` and return 401 if null.
- tRPC procedures must use `protectedProcedure` — no `publicProcedure` for mutations.

### RLS Policy Correctness
- Policies must use scalar boolean functions, not set-returning functions (see ENTERPRISE_PRINCIPLES.md #9).
- Check that `identity_vault` policy returns 0 rows for `authenticated` role.
- Check that `memberships` policies prevent cross-org data access.

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
