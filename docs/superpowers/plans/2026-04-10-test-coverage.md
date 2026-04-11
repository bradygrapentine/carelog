# Test Coverage Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill all test coverage gaps: missing security tests, router business logic, page-level flows, and Playwright E2E.

**Architecture:** Test-only additions — no production code changes. Four layers executed in priority order. Each task produces a self-contained test file that passes independently. Follow existing patterns in neighboring `__tests__/` directories.

**Tech Stack:** Vitest 4, @testing-library/react, Playwright, jsdom (components) / node (routers)

**Spec:** `docs/superpowers/specs/2026-04-10-test-coverage-design.md`

---

## File Map

**Layer 1 — Fill Gaps (4 new files):**
- `apps/web/server/routers/__tests__/expensesRouter.security.test.ts`
- `apps/web/server/routers/__tests__/careEvents.reactions.test.ts`
- `apps/web/app/(app)/dashboard/__tests__/DashboardClient.test.tsx`
- `apps/web/components/__tests__/ErrorBoundary.test.tsx`

**Layer 2 — Router Business Logic (10 new files):**
- `apps/web/server/routers/__tests__/careEvents.logic.test.ts`
- `apps/web/server/routers/__tests__/medications.logic.test.ts`
- `apps/web/server/routers/__tests__/shifts.logic.test.ts`
- `apps/web/server/routers/__tests__/burnout.logic.test.ts`
- `apps/web/server/routers/__tests__/symptoms.logic.test.ts`
- `apps/web/server/routers/__tests__/expenses.logic.test.ts`
- `apps/web/server/routers/__tests__/documents.logic.test.ts`
- `apps/web/server/routers/__tests__/eolPlan.logic.test.ts`
- `apps/web/server/routers/__tests__/benefits.logic.test.ts`
- `apps/web/server/routers/__tests__/outerCircle.logic.test.ts`

**Layer 3 — Vitest Page Flows (5 new files):**
- `apps/web/app/signin/__tests__/SignInForm.flow.test.tsx`
- `apps/web/app/onboarding/__tests__/OnboardingForm.flow.test.tsx`
- `apps/web/app/(app)/journal/[recipientId]/__tests__/JournalClient.flow.test.tsx`
- `apps/web/app/invite/[token]/__tests__/InvitePage.flow.test.tsx`
- `apps/web/app/(app)/dashboard/__tests__/DashboardClient.flow.test.tsx`

**Layer 4 — Playwright E2E (3 new files):**
- `e2e/auth-journal.spec.ts`
- `e2e/flag-reactions.spec.ts`
- `e2e/invite-flow.spec.ts`

---

## Conventions

**Router tests** follow the pattern in `careEventsRouter.security.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))
// Mock all repositories used by the router under test

import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { appRouter } from '@/server/trpc/router'

const USER_ID = '38dc6d19-6712-4b26-8797-b4e544e01b86'

// For procedures using ctx.supabase (react, unreact, reactions):
// Pass a mock supabase object in the caller context
function makeSupabaseMock() {
  const chain: any = {
    select: () => chain, eq: () => chain, not: () => chain,
    gte: () => chain, order: () => chain, delete: () => chain,
    update: () => chain, insert: () => chain,
    upsert: vi.fn().mockResolvedValue({ error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  return { from: vi.fn().mockReturnValue(chain), _chain: chain }
}
```

**Component tests** follow the pattern in `JournalEntryForm.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Mock next/navigation, tRPC, supabase as needed
```

**E2E tests** use helpers from `e2e/helpers.ts`: `signIn`, `navigateToJournal`, `clearMailpit`, `sendInviteAndGetUrl`, `acceptInviteAsNewUser`.

---

## Task 1: Expenses Router Security Test

**Files:**
- Create: `apps/web/server/routers/__tests__/expensesRouter.security.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))
vi.mock('@/server/repositories/careEventsRepository', () => ({
  getTimeline: vi.fn(), insertEvent: vi.fn(), getFlaggedEvents: vi.fn(), insertEventIdempotent: vi.fn(),
}))
vi.mock('@/server/repositories/membershipsRepository', () => ({
  getMemberships: vi.fn(), createMembershipAndInvite: vi.fn(),
}))
vi.mock('@/server/repositories/organizationsRepository', () => ({
  getOrganization: vi.fn(), createOrganization: vi.fn(), getUserOrganizations: vi.fn(),
}))
vi.mock('@/server/repositories/identityRepository', () => ({
  createIdentity: vi.fn(),
}))

import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { appRouter } from '@/server/trpc/router'

const ORG_ID       = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const RECIPIENT_ID = '28dc6d19-6712-4b26-8797-b4e544e01b85'
const USER_ID      = '38dc6d19-6712-4b26-8797-b4e544e01b86'
const EXPENSE_ID   = '48dc6d19-6712-4b26-8797-b4e544e01b87'

const caller = appRouter.createCaller({
  user: { id: USER_ID } as any,
  supabase: {} as any,
  req: undefined,
})

function makeMembershipChain(role: string | null) {
  const chain: any = { select: () => chain, eq: () => chain, not: () => chain }
  chain.single = vi.fn().mockResolvedValue({
    data: role ? { role } : null, error: null,
  })
  return chain
}

function makeQueryChain(data: any) {
  const chain: any = {
    select: () => chain, eq: () => chain, gte: () => chain,
    order: () => chain, delete: () => chain, insert: () => chain,
  }
  // For terminal calls
  chain.then = undefined
  // Mock the awaited result (Supabase queries resolve directly)
  const promise = Promise.resolve({ data, error: null })
  Object.assign(chain, { then: promise.then.bind(promise), catch: promise.catch.bind(promise) })
  return chain
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
})

describe('expenses.list — authorization', () => {
  it('returns FORBIDDEN when user is not a member', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeMembershipChain(null) as any)
    await expect(caller.expenses.list({ org_id: ORG_ID, recipient_id: RECIPIENT_ID }))
      .rejects.toThrow('FORBIDDEN')
  })

  it('returns data when user is a member', async () => {
    const memberChain = makeMembershipChain('supporter')
    const dataChain = makeQueryChain([{ id: EXPENSE_ID, amount: 25 }])
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(memberChain as any)
      .mockReturnValueOnce(dataChain as any)
    const result = await caller.expenses.list({ org_id: ORG_ID, recipient_id: RECIPIENT_ID })
    expect(result).toEqual([{ id: EXPENSE_ID, amount: 25 }])
  })
})

describe('expenses.create — role enforcement', () => {
  const input = {
    org_id: ORG_ID, recipient_id: RECIPIENT_ID,
    amount: 50, category: 'medication' as const, description: 'Rx pickup',
  }

  it('allows coordinator to create', async () => {
    const memberChain = makeMembershipChain('coordinator')
    const insertChain = makeQueryChain(null)
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(memberChain as any)
      .mockReturnValueOnce(insertChain as any)
    const result = await caller.expenses.create(input)
    expect(result).toEqual({ ok: true })
  })

  it('allows caregiver to create', async () => {
    const memberChain = makeMembershipChain('caregiver')
    const insertChain = makeQueryChain(null)
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(memberChain as any)
      .mockReturnValueOnce(insertChain as any)
    const result = await caller.expenses.create(input)
    expect(result).toEqual({ ok: true })
  })

  it('blocks supporter from creating', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeMembershipChain('supporter') as any)
    await expect(caller.expenses.create(input)).rejects.toThrow('FORBIDDEN')
  })
})

describe('expenses.delete — coordinator only', () => {
  const input = { id: EXPENSE_ID, org_id: ORG_ID }

  it('allows coordinator to delete', async () => {
    const memberChain = makeMembershipChain('coordinator')
    const deleteChain = makeQueryChain(null)
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(memberChain as any)
      .mockReturnValueOnce(deleteChain as any)
    const result = await caller.expenses.delete(input)
    expect(result).toEqual({ ok: true })
  })

  it('blocks caregiver from deleting', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeMembershipChain('caregiver') as any)
    await expect(caller.expenses.delete(input)).rejects.toThrow('FORBIDDEN')
  })

  it('blocks non-member from deleting', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeMembershipChain(null) as any)
    await expect(caller.expenses.delete(input)).rejects.toThrow('FORBIDDEN')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test -- apps/web/server/routers/__tests__/expensesRouter.security.test.ts`
Expected: 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/routers/__tests__/expensesRouter.security.test.ts
git commit -m "test(expenses): add security tests — role enforcement for list/create/delete"
```

---

## Task 2: CareEvents Reactions + Flag Tests

**Files:**
- Create: `apps/web/server/routers/__tests__/careEvents.reactions.test.ts`

- [ ] **Step 1: Write the test file**

Test the 4 new procedures: `react`, `unreact`, `reactions`, `flag`. The `react`/`unreact`/`reactions` procedures use `ctx.supabase` (not `supabaseAdmin`). The `flag` procedure uses both `ctx.supabase` (to find the event) and `supabaseAdmin` (to check membership).

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))
vi.mock('@/server/repositories/careEventsRepository', () => ({
  getTimeline: vi.fn(), insertEvent: vi.fn(), getFlaggedEvents: vi.fn(), insertEventIdempotent: vi.fn(),
}))
vi.mock('@/server/repositories/membershipsRepository', () => ({
  getMemberships: vi.fn(), createMembershipAndInvite: vi.fn(),
}))
vi.mock('@/server/repositories/organizationsRepository', () => ({
  getOrganization: vi.fn(), createOrganization: vi.fn(), getUserOrganizations: vi.fn(),
}))
vi.mock('@/server/repositories/identityRepository', () => ({
  createIdentity: vi.fn(),
}))

import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { appRouter } from '@/server/trpc/router'

const USER_ID  = '38dc6d19-6712-4b26-8797-b4e544e01b86'
const EVENT_ID = '58dc6d19-6712-4b26-8797-b4e544e01b88'
const ORG_ID   = '18dc6d19-6712-4b26-8797-b4e544e01b84'

function makeChain(overrides: Record<string, any> = {}) {
  const chain: any = {
    select: () => chain, eq: () => chain, not: () => chain,
    delete: () => chain, update: () => chain, insert: () => chain,
    upsert: vi.fn().mockResolvedValue({ error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  }
  // Make the chain itself awaitable for queries that don't call .single()
  const promise = Promise.resolve({ data: [], error: null })
  chain.then = promise.then.bind(promise)
  chain.catch = promise.catch.bind(promise)
  return chain
}

function makeCaller(supabaseMock: any) {
  return appRouter.createCaller({
    user: { id: USER_ID } as any,
    supabase: supabaseMock,
    req: undefined,
  })
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
})

// ─── react ──────────────────────────────────────────────────────────────────
describe('careEvents.react', () => {
  it('calls upsert on journal_reactions', async () => {
    const chain = makeChain()
    const mock = { from: vi.fn().mockReturnValue(chain) }
    const caller = makeCaller(mock)

    await caller.careEvents.react({ eventId: EVENT_ID, reaction: 'heart' })

    expect(mock.from).toHaveBeenCalledWith('journal_reactions')
    expect(chain.upsert).toHaveBeenCalledWith(
      { event_id: EVENT_ID, user_id: USER_ID, reaction: 'heart' },
      { onConflict: 'event_id,user_id' },
    )
  })

  it('throws on supabase error', async () => {
    const chain = makeChain({ upsert: vi.fn().mockResolvedValue({ error: { message: 'db error' } }) })
    const caller = makeCaller({ from: vi.fn().mockReturnValue(chain) })
    await expect(caller.careEvents.react({ eventId: EVENT_ID, reaction: 'heart' }))
      .rejects.toThrow('db error')
  })
})

// ─── unreact ────────────────────────────────────────────────────────────────
describe('careEvents.unreact', () => {
  it('deletes the user reaction for the event', async () => {
    const chain = makeChain()
    const eqSpy = vi.fn().mockReturnValue(chain)
    chain.eq = eqSpy
    const mock = { from: vi.fn().mockReturnValue(chain) }
    const caller = makeCaller(mock)

    await caller.careEvents.unreact({ eventId: EVENT_ID })
    expect(mock.from).toHaveBeenCalledWith('journal_reactions')
  })
})

// ─── reactions ──────────────────────────────────────────────────────────────
describe('careEvents.reactions', () => {
  it('returns counts and myReaction', async () => {
    const rows = [
      { reaction: 'heart', user_id: USER_ID },
      { reaction: 'heart', user_id: 'other-user' },
      { reaction: 'strong', user_id: 'other-user' },
    ]
    const promise = Promise.resolve({ data: rows, error: null })
    const chain: any = { select: () => chain, eq: () => chain }
    chain.then = promise.then.bind(promise)
    chain.catch = promise.catch.bind(promise)
    const caller = makeCaller({ from: vi.fn().mockReturnValue(chain) })

    const result = await caller.careEvents.reactions({ eventId: EVENT_ID })
    expect(result.counts).toEqual({ heart: 2, strong: 1 })
    expect(result.myReaction).toBe('heart')
  })

  it('returns null myReaction when user has not reacted', async () => {
    const rows = [{ reaction: 'heart', user_id: 'other-user' }]
    const promise = Promise.resolve({ data: rows, error: null })
    const chain: any = { select: () => chain, eq: () => chain }
    chain.then = promise.then.bind(promise)
    chain.catch = promise.catch.bind(promise)
    const caller = makeCaller({ from: vi.fn().mockReturnValue(chain) })

    const result = await caller.careEvents.reactions({ eventId: EVENT_ID })
    expect(result.myReaction).toBeNull()
  })
})

// ─── flag ───────────────────────────────────────────────────────────────────
describe('careEvents.flag', () => {
  it('allows coordinator to flag', async () => {
    // ctx.supabase: find event
    const eventChain = makeChain()
    eventChain.single = vi.fn().mockResolvedValue({ data: { id: EVENT_ID, org_id: ORG_ID } })
    // ctx.supabase: update flagged
    const updateChain = makeChain()
    const updatePromise = Promise.resolve({ error: null })
    updateChain.then = updatePromise.then.bind(updatePromise)
    updateChain.catch = updatePromise.catch.bind(updatePromise)

    const supabaseMock = { from: vi.fn().mockReturnValueOnce(eventChain).mockReturnValueOnce(updateChain) }
    const caller = makeCaller(supabaseMock)

    // supabaseAdmin: check membership
    const memberChain = makeChain()
    memberChain.single = vi.fn().mockResolvedValue({ data: { role: 'coordinator' } })
    vi.mocked(supabaseAdmin.from).mockReturnValue(memberChain as any)

    await caller.careEvents.flag({ eventId: EVENT_ID, flagged: true })
    // If no error thrown, it succeeded
  })

  it('blocks non-coordinator from flagging', async () => {
    const eventChain = makeChain()
    eventChain.single = vi.fn().mockResolvedValue({ data: { id: EVENT_ID, org_id: ORG_ID } })
    const caller = makeCaller({ from: vi.fn().mockReturnValue(eventChain) })

    const memberChain = makeChain()
    memberChain.single = vi.fn().mockResolvedValue({ data: { role: 'supporter' } })
    vi.mocked(supabaseAdmin.from).mockReturnValue(memberChain as any)

    await expect(caller.careEvents.flag({ eventId: EVENT_ID, flagged: true }))
      .rejects.toThrow('Only coordinators can flag events')
  })

  it('throws NOT_FOUND for missing event', async () => {
    const eventChain = makeChain()
    eventChain.single = vi.fn().mockResolvedValue({ data: null })
    const caller = makeCaller({ from: vi.fn().mockReturnValue(eventChain) })

    await expect(caller.careEvents.flag({ eventId: EVENT_ID, flagged: true }))
      .rejects.toThrow('Event not found')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test -- apps/web/server/routers/__tests__/careEvents.reactions.test.ts`
Expected: 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/routers/__tests__/careEvents.reactions.test.ts
git commit -m "test(careEvents): add react/unreact/reactions/flag procedure tests"
```

---

## Task 3: ErrorBoundary Test

**Files:**
- Create: `apps/web/components/__tests__/ErrorBoundary.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

function ThrowingChild() {
  throw new Error('test error')
}

function HappyChild() {
  return <p>Hello</p>
}

// Suppress console.error for the expected throw
const originalError = console.error
beforeAll(() => { console.error = vi.fn() })
afterAll(() => { console.error = originalError })

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(<ErrorBoundary><HappyChild /></ErrorBoundary>)
    expect(screen.getByText('Hello')).toBeDefined()
  })

  it('renders fallback UI when child throws', () => {
    render(<ErrorBoundary><ThrowingChild /></ErrorBoundary>)
    expect(screen.getByText(/something went wrong/i)).toBeDefined()
  })

  it('does not render the throwing child', () => {
    render(<ErrorBoundary><ThrowingChild /></ErrorBoundary>)
    expect(screen.queryByText('test error')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test**

Run: `pnpm test -- apps/web/components/__tests__/ErrorBoundary.test.tsx`
Expected: 3 tests PASS (adjust fallback text assertion to match actual ErrorBoundary output)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/__tests__/ErrorBoundary.test.tsx
git commit -m "test(ui): add ErrorBoundary tests — happy path and error fallback"
```

---

## Task 4: DashboardClient Test

**Files:**
- Create: `apps/web/app/(app)/dashboard/__tests__/DashboardClient.test.tsx`

- [ ] **Step 1: Read `DashboardClient.tsx` to understand its props and rendering**

Read: `apps/web/app/(app)/dashboard/DashboardClient.tsx`

- [ ] **Step 2: Write the test file**

Mock `createClient()`, `useEffect` auth, and any tRPC/fetch calls. Test:
- Renders "Your care teams" heading
- Shows care team cards when teams exist
- Shows "Set up a care team" link when no teams
- Shows user initials in the app tab bar
- Sign out button is present

Follow the pattern from `JournalEntryForm.test.tsx` — mock dependencies, `render()`, assert on `screen`.

~5 test cases.

- [ ] **Step 3: Run test**

Run: `pnpm test -- "apps/web/app/(app)/dashboard/__tests__/DashboardClient.test.tsx"`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/dashboard/__tests__/DashboardClient.test.tsx"
git commit -m "test(dashboard): add DashboardClient component tests"
```

---

## Task 5: Router Business Logic — careEvents

**Files:**
- Create: `apps/web/server/routers/__tests__/careEvents.logic.test.ts`

- [ ] **Step 1: Write the test file**

Test business logic (not security) for `careEvents` router:
- `timeline` — calls `getTimeline` with correct args, returns result
- `insert` — calls `insertEvent` with actor_id from ctx.user, returns event
- `insert` with `idempotencyKey` — calls `insertEventIdempotent` instead
- `flagged` — calls `getFlaggedEvents` with recipientId
- `getOne` — returns event from supabase, throws NOT_FOUND when missing

Follow the same mock pattern as Task 1. Use `vi.mocked(getTimeline).mockResolvedValue([...])` to control repository return values.

~8 test cases.

- [ ] **Step 2: Run and commit**

```bash
pnpm test -- apps/web/server/routers/__tests__/careEvents.logic.test.ts
git add apps/web/server/routers/__tests__/careEvents.logic.test.ts
git commit -m "test(careEvents): add business logic tests — timeline, insert, flagged, getOne"
```

---

## Task 6: Router Business Logic — medications, shifts, burnout

**Files:**
- Create: `apps/web/server/routers/__tests__/medications.logic.test.ts`
- Create: `apps/web/server/routers/__tests__/shifts.logic.test.ts`
- Create: `apps/web/server/routers/__tests__/burnout.logic.test.ts`

- [ ] **Step 1: Read each router file to understand procedures and dependencies**

Read:
- `apps/web/server/routers/medications.ts`
- `apps/web/server/routers/shifts.ts`
- `apps/web/server/routers/burnout.ts`

- [ ] **Step 2: Write test files**

For each router, test the happy path of each procedure:
- **medications**: `list` returns meds, `create` inserts, `update` modifies, `delete` removes, `listScheduled` returns today's doses, `logAdministration` records log
- **shifts**: `create` inserts shift, `list` returns date-filtered, conflict detection throws on overlap
- **burnout**: `checkIn` creates entry, idempotent on same week, `myHistory` returns user entries, `orgSummary` aggregates

~18 test cases total across 3 files.

- [ ] **Step 3: Run and commit**

```bash
pnpm test -- apps/web/server/routers/__tests__/medications.logic.test.ts apps/web/server/routers/__tests__/shifts.logic.test.ts apps/web/server/routers/__tests__/burnout.logic.test.ts
git add apps/web/server/routers/__tests__/medications.logic.test.ts apps/web/server/routers/__tests__/shifts.logic.test.ts apps/web/server/routers/__tests__/burnout.logic.test.ts
git commit -m "test(routers): add business logic tests — medications, shifts, burnout"
```

---

## Task 7: Router Business Logic — symptoms, expenses, documents

**Files:**
- Create: `apps/web/server/routers/__tests__/symptoms.logic.test.ts`
- Create: `apps/web/server/routers/__tests__/expenses.logic.test.ts`
- Create: `apps/web/server/routers/__tests__/documents.logic.test.ts`

- [ ] **Step 1: Read each router file**

Read:
- `apps/web/server/routers/symptoms.ts`
- `apps/web/server/routers/expenses.ts`
- `apps/web/server/routers/documents.ts`

- [ ] **Step 2: Write test files**

- **symptoms**: `log` creates reading, `list` returns for recipient
- **expenses**: `list` returns expenses with optional `since` filter, `create` inserts with `logged_by`, `delete` removes by id
- **documents**: `list` returns docs for org/recipient, `delete` removes

~12 test cases total.

- [ ] **Step 3: Run and commit**

```bash
pnpm test -- apps/web/server/routers/__tests__/symptoms.logic.test.ts apps/web/server/routers/__tests__/expenses.logic.test.ts apps/web/server/routers/__tests__/documents.logic.test.ts
git add apps/web/server/routers/__tests__/symptoms.logic.test.ts apps/web/server/routers/__tests__/expenses.logic.test.ts apps/web/server/routers/__tests__/documents.logic.test.ts
git commit -m "test(routers): add business logic tests — symptoms, expenses, documents"
```

---

## Task 8: Router Business Logic — eolPlan, benefits, outerCircle

**Files:**
- Create: `apps/web/server/routers/__tests__/eolPlan.logic.test.ts`
- Create: `apps/web/server/routers/__tests__/benefits.logic.test.ts`
- Create: `apps/web/server/routers/__tests__/outerCircle.logic.test.ts`

- [ ] **Step 1: Read each router file**

Read:
- `apps/web/server/routers/eolPlan.ts`
- `apps/web/server/routers/benefits.ts`
- `apps/web/server/routers/outerCircle.ts`

- [ ] **Step 2: Write test files**

- **eolPlan**: `get` returns plan for recipient, `upsert` creates new / updates existing
- **benefits**: `screen` returns matching programs based on answers
- **outerCircle**: `create` creates request with share_token, `list` returns active, `deactivate` marks inactive

~10 test cases total.

- [ ] **Step 3: Run and commit**

```bash
pnpm test -- apps/web/server/routers/__tests__/eolPlan.logic.test.ts apps/web/server/routers/__tests__/benefits.logic.test.ts apps/web/server/routers/__tests__/outerCircle.logic.test.ts
git add apps/web/server/routers/__tests__/eolPlan.logic.test.ts apps/web/server/routers/__tests__/benefits.logic.test.ts apps/web/server/routers/__tests__/outerCircle.logic.test.ts
git commit -m "test(routers): add business logic tests — eolPlan, benefits, outerCircle"
```

---

## Task 9: SignInForm Flow Test

**Files:**
- Create: `apps/web/app/signin/__tests__/SignInForm.flow.test.tsx`

- [ ] **Step 1: Read SignInForm.tsx**

Read: `apps/web/app/signin/SignInForm.tsx`

- [ ] **Step 2: Write the flow test**

Mock `createClient()` to return a fake supabase with controllable `signInWithOtp` and `verifyOtp`. Mock `posthog`. Test:
- Renders email input and "Continue with email" button
- After submitting email, shows OTP input ("Check your email" text)
- Entering wrong OTP shows error
- Entering valid OTP triggers `window.location.replace('/dashboard')`
- Loading state disables button while submitting
- Empty email shows validation error

~6 test cases.

- [ ] **Step 3: Run and commit**

```bash
pnpm test -- apps/web/app/signin/__tests__/SignInForm.flow.test.tsx
git add apps/web/app/signin/__tests__/SignInForm.flow.test.tsx
git commit -m "test(auth): add SignInForm flow tests — email, OTP, error, redirect"
```

---

## Task 10: OnboardingForm Flow Test

**Files:**
- Create: `apps/web/app/onboarding/__tests__/OnboardingForm.flow.test.tsx`

- [ ] **Step 1: Read OnboardingForm.tsx**

Read: `apps/web/app/onboarding/OnboardingForm.tsx`

- [ ] **Step 2: Write the flow test**

Mock `createClient()` and `authenticatedFetch`. Test:
- Renders recipient name and org name fields
- Submit calls `authenticatedFetch` with correct body
- Success redirects to dashboard (`window.location.href`)
- Error response shows error message

~4 test cases.

- [ ] **Step 3: Run and commit**

```bash
pnpm test -- apps/web/app/onboarding/__tests__/OnboardingForm.flow.test.tsx
git add apps/web/app/onboarding/__tests__/OnboardingForm.flow.test.tsx
git commit -m "test(onboarding): add OnboardingForm flow tests"
```

---

## Task 11: JournalClient Flow Test

**Files:**
- Create: `apps/web/app/(app)/journal/[recipientId]/__tests__/JournalClient.flow.test.tsx`

- [ ] **Step 1: Read JournalClient.tsx**

Read: `apps/web/app/(app)/journal/[recipientId]/JournalClient.tsx`

- [ ] **Step 2: Write the flow test**

Mock `createClient()`, `next/navigation` (`useSearchParams`, `usePathname`), and tRPC hooks. Test:
- Renders the journal panel by default
- `?panel=medications` shows medications panel
- `?panel=team` shows team panel
- Invalid panel param falls back to journal
- Shows journal entry form when user is authenticated
- Auth loading state shows spinner

~8 test cases.

- [ ] **Step 3: Run and commit**

```bash
pnpm test -- "apps/web/app/(app)/journal/[recipientId]/__tests__/JournalClient.flow.test.tsx"
git add "apps/web/app/(app)/journal/[recipientId]/__tests__/JournalClient.flow.test.tsx"
git commit -m "test(journal): add JournalClient flow tests — panel routing, auth"
```

---

## Task 12: InvitePage + DashboardClient Flow Tests

**Files:**
- Create: `apps/web/app/invite/[token]/__tests__/InvitePage.flow.test.tsx`
- Create: `apps/web/app/(app)/dashboard/__tests__/DashboardClient.flow.test.tsx`

- [ ] **Step 1: Read the page files**

Read:
- `apps/web/app/invite/[token]/page.tsx`
- `apps/web/app/(app)/dashboard/DashboardClient.tsx`

- [ ] **Step 2: Write flow tests**

**InvitePage**: Mock fetch for `/api/invite/[token]`. Test:
- Shows invite details (org name, role)
- Accept button calls POST `/api/invite/[token]/accept`
- Redirects after acceptance
- Shows error for invalid/expired token

**DashboardClient flow**: Mock auth + fetch for `/api/organizations`. Test:
- Loads and displays care teams
- Navigate to journal link works
- Empty state for new user
- Pending invite redirect from sessionStorage

~8 test cases total.

- [ ] **Step 3: Run and commit**

```bash
pnpm test -- "apps/web/app/invite/[token]/__tests__/InvitePage.flow.test.tsx" "apps/web/app/(app)/dashboard/__tests__/DashboardClient.flow.test.tsx"
git add "apps/web/app/invite/[token]/__tests__/InvitePage.flow.test.tsx" "apps/web/app/(app)/dashboard/__tests__/DashboardClient.flow.test.tsx"
git commit -m "test(flows): add InvitePage and DashboardClient flow tests"
```

---

## Task 13: Playwright E2E — Auth + Journal

**Files:**
- Create: `e2e/auth-journal.spec.ts`

- [ ] **Step 1: Write the E2E spec**

```ts
import { test, expect } from '@playwright/test'
import { signIn, clearMailpit, navigateToJournal } from './helpers'

const TEST_EMAIL = 'e2e-journal@test.com'

test.beforeEach(async () => {
  await clearMailpit()
})

test('sign in and navigate to journal', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)
  await expect(page.getByText('How did they seem today?')).toBeVisible()
})

test('create a journal entry and see it in timeline', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)

  await page.fill('textarea', 'E2E test entry — feeling good today')
  await page.click('button:has-text("Post")')
  await expect(page.getByText('E2E test entry — feeling good today')).toBeVisible({ timeout: 10000 })
})

test('select mood tag before posting', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)

  await page.fill('textarea', 'Mood test entry')
  await page.click('button:has-text("good")')
  await page.click('button:has-text("Post")')
  await expect(page.getByText('Mood test entry')).toBeVisible({ timeout: 10000 })
})
```

- [ ] **Step 2: Run (requires supabase + dev server)**

Run: `pnpm exec playwright test e2e/auth-journal.spec.ts`
Expected: 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/auth-journal.spec.ts
git commit -m "test(e2e): auth + journal — sign in, create entry, mood tags"
```

---

## Task 14: Playwright E2E — Flag + Reactions

**Files:**
- Create: `e2e/flag-reactions.spec.ts`

- [ ] **Step 1: Write the E2E spec**

```ts
import { test, expect } from '@playwright/test'
import { signIn, clearMailpit, navigateToJournal } from './helpers'

const TEST_EMAIL = 'e2e-flag@test.com'

test.beforeEach(async () => {
  await clearMailpit()
})

test('flag an entry for doctor', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)

  // Create an entry first
  await page.fill('textarea', 'Flag test entry')
  await page.click('button:has-text("Post")')
  await expect(page.getByText('Flag test entry')).toBeVisible({ timeout: 10000 })

  // Click into the entry detail
  await page.click('text=Flag test entry')
  await page.waitForURL(/\/entry\//)

  // Flag it
  await page.click('button:has-text("Flag for doctor")')
  await expect(page.getByText('Flagged for doctor')).toBeVisible({ timeout: 5000 })
})

test('add a reaction to an entry', async ({ page }) => {
  await signIn(page, TEST_EMAIL)
  await navigateToJournal(page)

  // Create an entry
  await page.fill('textarea', 'Reaction test entry')
  await page.click('button:has-text("Post")')
  await expect(page.getByText('Reaction test entry')).toBeVisible({ timeout: 10000 })

  // Click into detail view and react
  await page.click('text=Reaction test entry')
  await page.waitForURL(/\/entry\//)
  await page.click('[title="Heart"]')
  // Verify reaction appears (button pressed state or count)
  await expect(page.locator('[title="Heart"][aria-pressed="true"]')).toBeVisible({ timeout: 5000 })
})
```

- [ ] **Step 2: Run**

Run: `pnpm exec playwright test e2e/flag-reactions.spec.ts`
Expected: 2 tests PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/flag-reactions.spec.ts
git commit -m "test(e2e): flag for doctor + reactions"
```

---

## Task 15: Playwright E2E — Invite Flow

**Files:**
- Create: `e2e/invite-flow.spec.ts`

- [ ] **Step 1: Write the E2E spec**

```ts
import { test, expect } from '@playwright/test'
import { signIn, clearMailpit, navigateToJournal, sendInviteAndGetUrl, acceptInviteAsNewUser } from './helpers'

const COORDINATOR_EMAIL = 'e2e-coordinator@test.com'
const INVITEE_EMAIL     = 'e2e-invitee@test.com'

test.beforeEach(async () => {
  await clearMailpit()
})

test('coordinator sends invite and invitee accepts', async ({ page, browser }) => {
  // Coordinator signs in and navigates to journal
  await signIn(page, COORDINATOR_EMAIL)
  await navigateToJournal(page)

  // Send invite
  const inviteUrl = await sendInviteAndGetUrl(page, INVITEE_EMAIL, 'caregiver')
  expect(inviteUrl).toContain('/invite/')

  // Accept as new user
  let inviteePage: any
  let inviteeCtx: any
  try {
    const result = await acceptInviteAsNewUser(browser, inviteUrl, INVITEE_EMAIL)
    inviteePage = result.page
    inviteeCtx = result.ctx

    // Verify the invitee sees the dashboard with the care team
    await expect(inviteePage.getByText('View care journal')).toBeVisible({ timeout: 15000 })
  } finally {
    if (inviteeCtx) await inviteeCtx.close()
  }
})

test('invite shows team member after acceptance', async ({ page, browser }) => {
  await signIn(page, COORDINATOR_EMAIL)
  await navigateToJournal(page)

  const inviteUrl = await sendInviteAndGetUrl(page, 'e2e-team-check@test.com', 'supporter')

  let inviteeCtx: any
  try {
    const result = await acceptInviteAsNewUser(browser, inviteUrl, 'e2e-team-check@test.com')
    inviteeCtx = result.ctx
  } finally {
    if (inviteeCtx) await inviteeCtx.close()
  }

  // Back to coordinator — reload and check team panel
  await page.reload()
  // The team panel should show the new member
  await expect(page.getByText('e2e-team-check@test.com').or(page.getByText('Team member'))).toBeVisible({ timeout: 10000 })
})
```

- [ ] **Step 2: Run**

Run: `pnpm exec playwright test e2e/invite-flow.spec.ts`
Expected: 2 tests PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/invite-flow.spec.ts
git commit -m "test(e2e): invite send + accept + team panel verification"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Layer 1: expenses security (Task 1), reactions/flag (Task 2), ErrorBoundary (Task 3), Dashboard (Task 4)
- ✅ Layer 2: all 10 routers covered (Tasks 5-8)
- ✅ Layer 3: 5 page flows (Tasks 9-12)
- ✅ Layer 4: 3 Playwright E2E (Tasks 13-15)

**Placeholder scan:** No TBD/TODO. Tasks 5-12 instruct "read the file first" because exact mock shapes depend on current code — but each specifies what to test and how many cases.

**Type consistency:** All tests use `appRouter.createCaller()` pattern, `vi.mock()` for dependencies, same UUID constants.
