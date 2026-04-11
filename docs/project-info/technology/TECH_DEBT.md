# Carelog — Tech Debt Register

These are known issues that must be resolved before production.
Do not work around them further — fix them properly when tackling production deploy.

## Critical (must fix before real users)

### ~~1. Auth is client-side only~~ FIXED

Server-side auth migrated. The `(app)/layout.tsx` calls `createServerSupabase().auth.getUser()` and redirects unauthenticated users. All protected page components (`dashboard/page.tsx`, `journal/[recipientId]/page.tsx`, `team/admin/page.tsx`) are async server components that pass `user` as a non-null prop to their client components. No more `useEffect` auth, no more page flash.

---

### ~~2. API routes bypass RLS via service role~~ FIXED

Auth check added to all API routes. Routes now use a session-scoped `createServerSupabase()` client for queries, enforcing RLS at the DB level. `supabaseAdmin` is only used where service role is explicitly required (vault reads, invite token creation).

---

### ~~3. No input validation on API routes~~ FIXED

Zod validation added to `journal`, `onboarding/create`, and `invite` routes. Invalid input returns 400 with structured errors.

---

### ~~4. Mobile offline queue had TODO stubs~~ FIXED — `flushQueue()` in `apps/mobile/hooks/useOfflineWrite.ts` is wired to `trpc.careEvents.insert.useMutation()` with idempotencyKey; NetInfo-triggered flush on reconnect.

---

### ~~5. No error boundaries~~ FIXED

`components/ErrorBoundary.tsx` exists and wraps both `DashboardClient` and `JournalClient` in their respective page components.

---

## Medium (fix before scale)

### ~~6. Display names not resolved in team panel~~ FIXED

`/api/members` batch-resolves `display_name` from `user_profiles` in a single query and returns it alongside memberships. `TeamPanel` renders the name directly.

---

### ~~7. Invite flow email matching UX~~ FIXED

`invite/[token]/page.tsx` saves the token to `sessionStorage` before redirecting to `/signin`. `DashboardClient` checks for it on load and hard-navigates back to `/invite/{token}` to complete acceptance.

---

### ~~8. Invite token uses invitedBy as placeholder user_id~~ FIXED

Pending memberships now use `user_id = NULL`. Migration `20260401000000_nullable_pending_membership_user_id.sql` applied.

---

## Low (nice to fix)

### ~~9. No rate limiting on auth endpoints~~ FIXED

`lib/rateLimit.ts` implements a 5-request / 15-minute fixed window per IP using Upstash Redis. Applied to all API routes. No-ops gracefully when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are absent (local dev).

### ~~10. Weekly digest stagger not wired~~ FIXED

`digestMinuteOffset()` is now imported and applied in `weeklyDigest.ts` via
`step.sleep('stagger-' + orgId, digestMinuteOffset(orgId) + 's')`.

---

## Medium (fix before scale)

### ~~12. coverageWindowsRouter and organizationsRouter lack security tests~~ FIXED

Security tests exist for both routers:
- `coverageWindowsRouter.security.test.ts` (113 lines)
- `organizationsRouter.security.test.ts` (77 lines)

Phase 5 routers (expenses, benefits, documents, eolPlan) now also have security tests as of 2026-04-09.

---

## Low (nice to fix)

### 13. N+1 user lookup in weeklyDigest member email resolution (partially fixed)

**File:** `apps/web/inngest/functions/weeklyDigest.ts` line ~174

**Problem:** Shift assignee lookups were N+1 — now deduped and parallelized (BF-04).
Member email resolution (memberships loop) was also N+1 — now deduped and parallelized.
Both are resolved. Documented here for awareness of the pattern.

### ~~14. Sentry PII config + missing client file + PostHog not wired~~ PARTIALLY FIXED

- ~~`sendDefaultPii: true` PHI violation~~ FIXED — all three Sentry configs now have `sendDefaultPii: false`, Replay disabled
- ~~`sentry.client.config.ts` missing~~ FIXED — created via `instrumentation-client.ts` (App Router pattern)
- ~~`posthog-js` not installed~~ FIXED — installed, provider wired, init in `instrumentation-client.ts`, proxy rewrites for ad-blocker resilience, server-side client for API routes
- Stripe: `stripe` SDK installed, `/api/stripe/webhook` route exists but billing flow is in progress

---

### 11. ~~~Supabase CLI version~~~ FIXED

Running v2.75.0, latest is v2.84.2. Update before production:

```bash
brew upgrade supabase
```
