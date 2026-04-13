# Overnight Backlog

Stories in this file are picked up by the nightly development agent (runs 2am Chicago / 8am UTC).

## Format rules
- Mark completed stories `✅ DONE` — the agent skips them
- List prerequisites in `**Blocked by:**` — agent skips blocked stories
- One story per `###` heading with a unique ID (e.g. `P4-01`)

## Sequencing Overview

```
ON-01 BUILD_STATUS housekeeping  ─── no deps, run first (5 min)
ON-02 Auth E2E regression test   ─── no deps, validates proxy.ts fix
ON-03 Billing E2E                ─── no deps
ON-04 Phase 4-5 E2E coverage     ─── no deps, largest story, fan-out
ON-05 Phase 2 shifts E2E         ─── no deps
ON-06 Mobile token compliance    ─── no deps, quick cleanup
ON-07 push_tokens pgTAP test     ─── no deps, RLS coverage gap
ON-08 Dead code removal          ─── no deps, quick cleanup
ON-09 SignInForm loading bug     ─── no deps, one-line fix + test
```

All stories are independent — agent may run ON-02 through ON-09 in parallel.

---

## Stories

---

### ON-01 — BUILD_STATUS.md housekeeping

**What:** Mark the two completed items that are currently unchecked.

**Files to change:**
- `docs/project-info/product/BUILD_STATUS.md`
  - Check `[ ] Stripe billing` — routes, webhook, billing page, and tests are all done (sonar-report.xml confirms 28 passing test cases)
  - Add a line under "Before launch" or "Infrastructure": `[x] Proxy (Next.js 16 middleware) — session refresh wired; OTP→dashboard redirect fixed 2026-04-13`

**Acceptance criteria:**
- [ ] Stripe checkbox is `[x]`
- [ ] Proxy/auth fix is documented in BUILD_STATUS.md

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-02 — Auth proxy regression E2E test

**Context:** `apps/web/proxy.ts` was a no-op (`return NextResponse.next()`). It was fixed today (2026-04-13) to call `supabase.auth.getUser()` and propagate refreshed session cookies. Without this fix, OTP sign-in succeeded client-side but `(app)/layout.tsx` could not see the session server-side, causing an immediate redirect back to `/signin`.

**What:** Write a Playwright E2E test that exercises the full OTP sign-in flow so this regression can never ship silently again.

**Technical details:**
- The existing `e2e/auth.spec.ts` has a sign-in test but may not assert that the user lands on `/dashboard`
- Read `e2e/auth.spec.ts` first — extend it or write a separate `e2e/auth-proxy.spec.ts`
- Use Supabase test user / Mailpit OTP approach already established in the E2E suite
- Assert: after OTP confirm, `page.url()` contains `/dashboard` (not `/signin`)
- Assert: no redirect loop (URL does not momentarily visit `/signin` then redirect away)

**Files to change:**
- `e2e/auth-proxy.spec.ts` — new spec (or extend `e2e/auth.spec.ts` with a redirect assertion)
- Read `e2e/CLAUDE.md` and existing auth spec before writing — follow established patterns

**Acceptance criteria:**
- [ ] Test signs in with valid OTP and asserts final URL is `/dashboard`
- [ ] Test fails if proxy is reverted to the no-op version (verified by code inspection)
- [ ] `pnpm exec playwright test e2e/auth-proxy.spec.ts` passes

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-03 — Billing E2E test

**Context:** Stripe routes are fully implemented (checkout, portal, webhook, verify — 28 unit tests in sonar-report.xml) but there are no Playwright E2E tests for the billing page or Stripe checkout flow.

**Technical details:**
- Read `apps/web/app/(app)/billing/BillingClient.tsx` and `billing/page.tsx` before writing
- Coordinator navigates to `/billing` — sees Free Plan with upgrade buttons
- Mock the Stripe checkout API call (intercept `/api/stripe/checkout` in Playwright, return `{ url: 'https://checkout.stripe.com/test' }`)
- Assert the billing page renders for coordinators
- Assert non-coordinators see "Contact your coordinator to manage billing"
- Test the billing `/success` page redirect: visit `/billing/success?session_id=cs_test_xxx` and assert it renders without 500
- Read `apps/web/app/(app)/billing/success/page.tsx` to understand what it expects

**Files to change:**
- `e2e/billing.spec.ts` — new

**Acceptance criteria:**
- [ ] Coordinator sees billing page with upgrade buttons
- [ ] Supporter/caregiver sees "Contact your coordinator" message
- [ ] Clicking upgrade calls `/api/stripe/checkout` (verified via route.fulfill intercept)
- [ ] `pnpm exec playwright test e2e/billing.spec.ts` passes

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-04 — E2E coverage for Phase 4–5 features

**Context:** The following features shipped in Phases 4–5 but have NO Playwright E2E tests. Each has full unit test coverage but no integration-level browser test.

| Feature | Web route | Has E2E? |
|---------|-----------|----------|
| Expenses | journal page → expense panel | ❌ |
| Outer circle (volunteer board) | `/care/[token]` public page | ❌ |
| Care brief | `/brief/[token]` public page | ❌ |
| Benefits navigator | journal page → benefits panel | ❌ |
| EOL planner | journal page → eol planner panel | ❌ |
| History export | journal page → export button | ❌ |

**Instructions:**
1. Read the existing Phase 4-5 component files before writing tests
2. Follow the established E2E pattern in `e2e/documents.spec.ts` and `e2e/burnout.spec.ts` as templates
3. Read `e2e/CLAUDE.md` for test helpers and auth setup patterns
4. Write one spec file per feature — do not bundle unrelated features into one file
5. Public pages (`/care/[token]`, `/brief/[token]`) should be tested without auth (Playwright no-auth context)
6. Coordinator-only features: assert non-coordinators cannot see the form/button

**Files to create:**
- `e2e/expenses.spec.ts`
- `e2e/outer-circle.spec.ts` — tests the public `/care/[token]` page claim flow
- `e2e/care-brief.spec.ts` — tests the public `/brief/[token]` render + revoke
- `e2e/benefits.spec.ts`
- `e2e/eol-planner.spec.ts`
- `e2e/export.spec.ts` — test coordinator can initiate export, assert download headers

**Acceptance criteria:**
- [ ] Each spec file has at minimum: happy-path test + role-enforcement test
- [ ] Public page specs run without auth
- [ ] `pnpm exec playwright test e2e/expenses.spec.ts` passes (and similarly for each)
- [ ] No test uses hardcoded UUIDs — use test fixtures / data created in beforeEach

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-05 — E2E tests for Phase 2 scheduler (shifts)

**Context:** Shifts, coverage windows, and gap detection shipped in Phase 2 but have no Playwright E2E tests. The gap detector runs as an Inngest cron; only the UI-facing shift creation and display need E2E coverage.

**Technical details:**
- Read `apps/web/app/journal/[recipientId]/ShiftForm.tsx` and `ShiftList.tsx` before writing
- Coordinator creates a shift → assert it appears in ShiftList
- Caregiver sees their shift highlighted with "Your shift" label
- Coordinator can cancel a shift → status badge updates
- Coverage settings: coordinator adds a coverage window → appears in list

**Files to create:**
- `e2e/shifts.spec.ts`
- `e2e/coverage-settings.spec.ts`

**Acceptance criteria:**
- [ ] Coordinator creates shift, shift appears in list with correct status badge
- [ ] Non-coordinator cannot see the ShiftForm
- [ ] Cancel flow: shift status changes to "cancelled" in ShiftList
- [ ] `pnpm exec playwright test e2e/shifts.spec.ts` passes

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-06 — Mobile design token compliance: More screen + tab navigator

**Context:** Two mobile files use raw hex colors instead of the design token system. Per `apps/mobile/CLAUDE.md`: "Never use raw hex in screen files — always import from tokens."

**Files with violations:**

1. `apps/mobile/app/(app)/more/index.tsx` — uses inline `StyleSheet.create` with hardcoded hex:
   - `backgroundColor: "#fff"` → `colors.surface` (or equivalent from tokens.ts)
   - `color: "#111827"` (heading and label) → `colors.ink`
   - `backgroundColor: "#f9fafb"` (card) → `colors.surfaceSubtle` or similar
   - `borderColor: "#e5e7eb"` (card border) → `colors.border`
   - Also uses emoji icons — check if the token system has icon conventions

2. `apps/mobile/app/(app)/_layout.tsx` — uses `tabBarActiveTintColor: "#0369a1"` — replace with token value

**Instructions:**
1. Read `apps/mobile/constants/tokens.ts` first to find the correct token names
2. In `more/index.tsx`: replace raw hex with token imports; preserve all layout logic
3. In `_layout.tsx`: replace the hex tint color with the correct primary token
4. Run `pnpm typecheck` to confirm no type errors introduced
5. Do NOT change any functionality, navigation, or component structure

**Acceptance criteria:**
- [ ] No raw hex strings in `more/index.tsx` or `_layout.tsx`
- [ ] All colors reference named tokens from `constants/tokens.ts`
- [ ] `pnpm typecheck` passes
- [ ] Existing mobile Jest tests still pass: `cd apps/mobile && pnpm test`

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-07 — pgTAP RLS test for push_tokens

**Context:** `supabase/migrations/20260415000000_push_tokens.sql` creates the `push_tokens` table with an "owner-only" RLS policy. There is no `supabase/tests/push_tokens_rls.test.sql` — this policy has never been tested.

**Instructions:**
- Read the migration file to understand the exact policy definition
- Follow the pattern in `supabase/tests/expenses_rls.test.sql` (simplest existing example)
- Read `supabase/CLAUDE.md` for pgTAP conventions before writing

**Cases to cover:**
1. Owner can insert their own token (passes)
2. Owner can select their own tokens (passes)
3. Another user cannot select someone else's tokens (blocked)
4. Another user cannot insert a token for a different user_id (blocked)
5. Unauthenticated request is blocked

**Files to create:**
- `supabase/tests/push_tokens_rls.test.sql`

**Acceptance criteria:**
- [ ] `supabase test db` passes with new file included
- [ ] Uses 4-arg `throws_ok` form (not 2-arg) per pgTAP conventions
- [ ] File follows existing naming and header conventions

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-08 — Dead code removal: unused auth files ✅ DONE

(Completed 2026-04-13 during @supabase/ssr upgrade — both files deleted.)

**Context:** Two files are never imported or called from anywhere:

1. `apps/web/app/signin/actions.ts` — exports `verifyOtpAction` (Server Action). `SignInForm.tsx` calls `supabase.auth.verifyOtp()` directly on the browser client; this server action is dead.

2. `apps/web/app/auth/callback/route.ts` — a POST route handler that also verifies OTP. Not linked from the sign-in form or any other file; duplicates `apps/web/app/api/auth/verify/route.ts`.

**Instructions:**
1. Grep `apps/web` for any import of `verifyOtpAction` and any reference to `auth/callback` to confirm they are unreferenced
2. Only delete if confirmed unused
3. Delete confirmed dead files
4. Run `pnpm typecheck` and `pnpm test`

**Files to delete (after confirming unused):**
- `apps/web/app/signin/actions.ts`
- `apps/web/app/auth/callback/route.ts`

**Acceptance criteria:**
- [ ] Both files deleted (or a comment explaining why one was kept)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

**Blocked by:** nothing
**Blocks:** nothing

---

### ON-09 — Fix SignInForm loading state stuck on success (TDD)

**Context:** `apps/web/app/signin/SignInForm.tsx` `handleVerifyOtp` never calls `setLoading(false)` on the happy path. If `router.replace("/dashboard")` is delayed or fails, the submit button is stuck on "Signing you in…" with no way to retry.

**TDD approach — write the failing test first:**

```ts
// assert button returns to "Sign in" after verifyOtp resolves
// even when router.replace is mocked to do nothing
```

**Fix (one line, after the test is written):**
```ts
// apps/web/app/signin/SignInForm.tsx — before router.replace:
setLoading(false);
router.replace("/dashboard");
```

**Files to change:**
- `apps/web/app/signin/__tests__/SignInForm.flow.test.tsx` — add failing test first
- `apps/web/app/signin/SignInForm.tsx` — add `setLoading(false)` before `router.replace`

**Acceptance criteria:**
- [ ] Failing test written before the fix (TDD order enforced)
- [ ] Test mocks `router.replace` to a no-op and asserts button label returns to "Sign in"
- [ ] `pnpm test` passes

**Blocked by:** nothing
**Blocks:** nothing
