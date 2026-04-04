# Carelog — Tech Debt Register

These are known issues that must be resolved before production.
Do not work around them further — fix them properly when tackling production deploy.

## Critical (must fix before real users)

### 1. Auth is client-side only
**File:** all protected pages use `useEffect` + `createClient().auth.getUser()`

**Problem:** `createServerSupabase()` can't read the session in local dev because
the Supabase cookie name (`sb-127-auth-token`) doesn't match what `@supabase/ssr`
expects. All protected pages use client-side auth as a workaround.

**Impact:** No server-side rendering of protected content. Pages flash before
auth check completes. SEO impossible for protected routes.

**Fix:** Deploy to Supabase cloud. The cookie is set correctly in production
and `createServerSupabase().auth.getUser()` will work. Then replace all
`useEffect` auth patterns with proper server component auth checks.

**Do not attempt to fix in local dev** — it works in production, and the fix
would be complex and fragile in the local environment.

---

### 2. API routes bypass RLS via service role
**Files:** `apps/web/app/api/journal/route.ts`, `apps/web/app/api/onboarding/create/route.ts`

**Problem:** These routes use `createClient(supabaseUrl, serviceRoleKey)` directly
to bypass RLS. This works because they're server-only, but it means the database's
RLS layer is not enforcing access control — the API route logic is.

**Impact:** A bug in the API route logic could expose data across orgs. RLS
should be the safety net, not the only gate.

**Fix:** Pass the authenticated user's session to the API route and use a
session-scoped Supabase client. Then RLS enforces org isolation at the DB level
and the API logic is just business logic, not security logic.

---

### 3. No input validation on API routes
**Files:** `apps/web/app/api/journal/route.ts`, `apps/web/app/api/onboarding/create/route.ts`, `apps/web/app/api/invite/route.ts`

**Problem:** Zod schemas exist in `@carelog/schemas` but are not used on these
routes. Validation is ad-hoc (`if (!field) return error`).

**Fix:** Import and use `validatePayload()` from `@carelog/schemas` at the top
of each API route handler. Return structured Zod errors to the client.

---

### 4. Mobile offline queue has TODO stubs
**File:** `apps/mobile/hooks/useOfflineWrite.ts`

**Problem:** The `flushQueue()` function has a TODO comment where the actual
tRPC call should be. The offline queue persists to SecureStore correctly but
never actually syncs.

**Fix:** Wire in the tRPC client and implement the actual flush call. Test on
a real device with airplane mode toggled.

---

### 5. No error boundaries
**Files:** `apps/web/app/dashboard/DashboardClient.tsx`, `apps/web/app/journal/[recipientId]/JournalClient.tsx`

**Problem:** Client component errors crash silently with no recovery UI.

**Fix:** Wrap each major client component tree with a React ErrorBoundary that
shows a friendly error message and a "Try again" button.

---

## Medium (fix before scale)

### 6. Display names not resolved in team panel
**File:** `apps/web/app/journal/[recipientId]/TeamPanel.tsx`

**Problem:** Team members show as "Team member" instead of their name because
we don't fetch names from the identity vault. The `display_names` cache table
exists but isn't used here.

**Fix:** Add a server-side API route that resolves display names from the cache
(or vault on cache miss) and returns them alongside memberships. The client
calls this route after loading members.

---

### 7. Invite flow email matching UX
**File:** `apps/web/app/invite/[token]/page.tsx`

**Problem:** If a user visits an invite link while signed in as a different email,
they see an error. The pending invite is stored in sessionStorage but the redirect
back to the invite URL after sign-in isn't fully implemented.

**Fix:** After sign-in via OTP, check `sessionStorage.getItem('pending_invite')`.
If present, redirect to `/invite/{token}` instead of `/dashboard`. The
DashboardClient already has the skeleton for this — just needs the redirect.

---

### ~~8. Invite token uses invitedBy as placeholder user_id~~ FIXED
Pending memberships now use `user_id = NULL`. Migration `20260401000000_nullable_pending_membership_user_id.sql` applied.

---

## Low (nice to fix)

### 9. No rate limiting on auth endpoints
OTP requests are not rate-limited beyond Supabase's built-in limits.
Add IP-based rate limiting via Upstash Redis before production.

### 10. Weekly digest stagger not wired
`digestMinuteOffset()` is implemented and tested but not used anywhere yet.
Wire it into the Inngest cron when building the digest feature.

### 11. Supabase CLI version
Running v2.75.0, latest is v2.84.2. Update before production:
```bash
brew upgrade supabase
```
