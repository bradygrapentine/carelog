# Test Coverage Completion — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Scope:** Fill coverage gaps, add router business logic tests, page flow tests, Playwright E2E

---

## 1. Current State

- 595 Vitest tests across 76 files (all passing)
- 12/13 tRPC router security tests (expenses missing)
- 14 API route tests
- 17 journal panel component tests (~487 cases)
- Sidebar, marketing, app shell component tests
- No router business logic tests (only auth/RLS enforcement)
- No integration/page-flow tests
- Existing Playwright E2E setup in `e2e/` but minimal coverage

---

## 2. Priority Layers

### Layer 1: Fill Gaps (4 files, ~26 cases)

Addresses missing coverage for existing and newly-added code.

| File | What | Cases |
|---|---|---|
| `server/routers/__tests__/expenses.security.test.ts` | RLS enforcement — supporter blocked, coordinator allowed, non-member blocked | ~6 |
| `server/routers/__tests__/careEvents.reactions.test.ts` | New react/unreact/reactions/flag procedures — upsert, delete, counts, coordinator-only flag | ~12 |
| `app/(app)/dashboard/__tests__/DashboardClient.test.tsx` | Renders care teams, empty state, sign-out button | ~5 |
| `components/__tests__/ErrorBoundary.test.tsx` | Catches error, renders fallback, happy path passes through | ~3 |

### Layer 2: Router Business Logic (10 files, ~60 cases)

Tests actual mutation/query behavior for each tRPC router. Mocks `ctx.supabase` to return expected data, verifies correct Supabase method calls and return shapes.

| File | Key behaviors tested |
|---|---|
| `careEvents.logic.test.ts` | insert creates event, timeline returns ordered, getOne returns single, flagged filters |
| `medications.logic.test.ts` | create/update/delete, listScheduled today's doses, logAdministration |
| `shifts.logic.test.ts` | create with conflict detection, list by date range, recurring bulk insert |
| `burnout.logic.test.ts` | checkIn idempotent (UNIQUE), myHistory user-scoped, orgSummary aggregates |
| `symptoms.logic.test.ts` | log creates reading, list returns for recipient |
| `expenses.logic.test.ts` | add creates, list with totals, delete |
| `documents.logic.test.ts` | list returns docs, delete removes |
| `eolPlan.logic.test.ts` | get returns plan, upsert creates/updates |
| `benefits.logic.test.ts` | screen returns matching programs |
| `outerCircle.logic.test.ts` | create request, list active, deactivate |

### Layer 3: Vitest Page Flows (5 files, ~26 cases)

Tests full page rendering with mocked tRPC/Supabase/router dependencies. Verifies user interaction sequences render correctly.

| File | Flow tested | Cases |
|---|---|---|
| `app/signin/__tests__/SignInForm.flow.test.tsx` | Email input → OTP submit → code step → verify redirect | ~6 |
| `app/onboarding/__tests__/OnboardingForm.flow.test.tsx` | Form fields → submit → redirect to dashboard | ~4 |
| `app/(app)/journal/[recipientId]/__tests__/JournalClient.flow.test.tsx` | Panels by URL, entry form, post entry, timeline update | ~8 |
| `app/invite/[token]/__tests__/InvitePage.flow.test.tsx` | Show invite details, accept, redirect | ~4 |
| `app/(app)/dashboard/__tests__/DashboardClient.flow.test.tsx` | Load teams, navigate to journal, empty state | ~4 |

### Layer 4: Playwright E2E (3 files, ~7 cases)

Browser-level tests against running local dev (Supabase + Next.js). Tests critical happy paths end-to-end.

| File | Flow | Cases |
|---|---|---|
| `e2e/auth-journal.spec.ts` | Sign in → dashboard → journal → create entry → verify timeline | ~3 |
| `e2e/flag-reactions.spec.ts` | Open entry → flag for doctor → add reaction → verify badge | ~2 |
| `e2e/invite.spec.ts` | Send invite → open URL → accept → verify team panel | ~2 |

---

## 3. Testing Patterns

### Router logic tests
- Mock `ctx.supabase` with `vi.fn()` chains: `.from().select().eq().single()` etc.
- Mock `ctx.user` with `{ id: 'uuid' }`
- Test return values and error cases (TRPCError throws)
- Use node environment (no jsdom needed)

### Page flow tests
- Use `@testing-library/react` with `render()` and `userEvent`
- Mock `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`)
- Mock tRPC hooks (`trpc.*.useQuery`, `trpc.*.useMutation`) via module mock
- Mock `createClient()` for auth state
- Assert on rendered output after user interactions

### Playwright E2E
- Requires `supabase start` + `pnpm web` running
- Create test user via Supabase admin API in `beforeAll`
- Use OTP bypass or direct session injection for auth
- Clean up test data in `afterAll`
- Follow existing `e2e/` patterns

---

## 4. Constraints

- No changes to production code — test-only additions
- Follow existing test patterns (check neighboring test files for style)
- `type` over `interface`, no `enum`
- No template literals in JSX props
- All tests must pass: `pnpm test` for Vitest, `pnpm exec playwright test` for E2E

---

## 5. Success Criteria

- Zero remaining tRPC routers without security tests
- Every router has business logic tests covering happy path + key error cases
- Critical user flows tested at component level
- 3 Playwright E2E specs covering sign-in, journal, and invite flows
- Total test count increases from ~595 to ~715+
