# Carelog — Tech Debt Register

These are known issues that must be resolved before production.
Do not work around them further — fix them properly when tackling production deploy.

## Critical (must fix before real users)

### 1. Auth is client-side only

**File:** all protected pages use `useEffect` + `createClient().auth.getUser()`

**Problem:** `createServerSupabase()` can't read the session in local dev because
the Supabase cookie name doesn't always match what `@supabase/ssr` expects. All
protected pages use client-side auth as a workaround.

**Note:** The `NEXT_PUBLIC_SUPABASE_URL` is now `http://localhost:54321` (not
`127.0.0.1`) so cookie names are consistent. API routes work with server-side
auth. Page-level auth (dashboard, journal) still uses the client-side pattern.

**Impact:** No server-side rendering of protected content. Pages flash before
auth check completes. SEO impossible for protected routes.

**Fix:** Deploy to Supabase cloud. The cookie is set correctly in production
and `createServerSupabase().auth.getUser()` will work. Then replace all
`useEffect` auth patterns with proper server component auth checks.

**Do not attempt to fix in local dev** — it works in production, and the fix
would be complex and fragile in the local environment.

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

### 14. Sentry PII config + missing client file + PostHog not wired

**Services:** Sentry (partial), PostHog (not started)

**Problem:**
- `@sentry/nextjs` IS installed; `sentry.server.config.ts` and `sentry.edge.config.ts` exist but have `sendDefaultPii: true` — **critical PHI violation**
- `sentry.client.config.ts` is missing (client-side errors not captured)
- `posthog-js` is not installed, no provider exists
- Stripe: `stripe` SDK installed, `/api/stripe/webhook` route and billing tRPC router do not exist

**Fix:** See `docs/superpowers/plans/2026-04-09-before-launch.md` — Tasks B1, B3, D2–D6.
Sentry PHI fix task file: `.worktrees/sentry-fix/AGENT_TASK.md`

---

### 15. Mobile design tokens not yet extracted

**File:** All files in `apps/mobile/app/` and `apps/mobile/utils/journalUtils.ts`

**Problem:** `apps/mobile/CLAUDE.md` documents `apps/mobile/constants/tokens.ts` as the source of truth for colors, typography, and spacing (mirroring web CSS vars). This file does not exist. All mobile screens use raw hex values directly in `StyleSheet.create()`.

**Fix:** Create `apps/mobile/constants/tokens.ts` mirroring `apps/web/app/globals.css` CSS variables, then replace raw hex in all screen files and `journalUtils.ts`.

**Impact:** Low — raw hex is consistent across all existing screens. Not a runtime bug.

---

### 11. ~~~Supabase CLI version~~~ FIXED

Running v2.75.0, latest is v2.84.2. Update before production:

```bash
brew upgrade supabase
```
