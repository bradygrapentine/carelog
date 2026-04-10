# P5-02 Benefits Navigator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coordinator-only benefits screener panel that surfaces matching government programs (Medicare Part D Extra Help, Medicaid HCBS, VA Aid & Attendance, PACE, SHIP) based on simple yes/no answers. Results are saved to the database for reference on revisit.

**Architecture:** Pure `eligibility(answers)` function in `lib/benefitsEligibility.ts` (no DB, fully testable). tRPC `benefitsRouter` saves screener runs and retrieves the latest. `BenefitsNavigator` component is completely hidden from non-coordinator roles.

**Tech Stack:** Supabase (Postgres + RLS), tRPC, React + Tailwind, Vitest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260413000001_benefits_screenings.sql` | Create | Table + RLS |
| `apps/web/lib/benefitsEligibility.ts` | Create | Pure eligibility function |
| `apps/web/lib/__tests__/benefitsEligibility.test.ts` | Create | Logic unit tests |
| `apps/web/server/routers/benefits.ts` | Create | tRPC router |
| `apps/web/server/trpc/router.ts` | Modify | Wire benefitsRouter |
| `apps/web/app/journal/[recipientId]/BenefitsNavigator.tsx` | Create | UI component |
| `apps/web/app/journal/[recipientId]/__tests__/BenefitsNavigator.test.tsx` | Create | Component tests |
| `apps/web/app/journal/[recipientId]/JournalClient.tsx` | Modify | Render BenefitsNavigator |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260413000001_benefits_screenings.sql`

- [ ] **Step 1: Write the migration**

```sql
-- P5-02: Benefits screener results
-- Saves coordinator screener runs for reference. Coordinator-only access.

CREATE TABLE benefits_screenings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  answers      jsonb       NOT NULL,
  results      jsonb       NOT NULL,
  created_by   uuid        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE benefits_screenings ENABLE ROW LEVEL SECURITY;

-- Coordinator-only read
CREATE POLICY "coordinator can read benefits_screenings"
  ON benefits_screenings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = benefits_screenings.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );

-- Coordinator-only insert
CREATE POLICY "coordinator can insert benefits_screenings"
  ON benefits_screenings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = benefits_screenings.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );
```

- [ ] **Step 2: Apply the migration**

```bash
supabase db reset
```

Expected: all migrations apply cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260413000001_benefits_screenings.sql
git commit -m "feat: benefits_screenings table + RLS (P5-02)"
```

---

## Task 2: Pure eligibility function + tests

**Files:**
- Create: `apps/web/lib/__tests__/benefitsEligibility.test.ts`
- Create: `apps/web/lib/benefitsEligibility.ts`

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/lib/__tests__/benefitsEligibility.test.ts
import { describe, it, expect } from 'vitest'
import { eligibility } from '../benefitsEligibility'

const NONE = {
  age65plus:        false,
  veteran:          false,
  lowIncome:        false,
  medicareEnrolled: false,
  medicaidEnrolled: false,
}

describe('eligibility — no matches', () => {
  it('returns empty array when no criteria match', () => {
    expect(eligibility(NONE)).toHaveLength(0)
  })
})

describe('eligibility — Medicare Part D Extra Help', () => {
  it('matches when age65plus + lowIncome + medicareEnrolled', () => {
    const results = eligibility({ ...NONE, age65plus: true, lowIncome: true, medicareEnrolled: true })
    expect(results.map(r => r.key)).toContain('medicare_part_d_extra_help')
  })

  it('does NOT match when not on Medicare', () => {
    const results = eligibility({ ...NONE, age65plus: true, lowIncome: true, medicareEnrolled: false })
    expect(results.map(r => r.key)).not.toContain('medicare_part_d_extra_help')
  })
})

describe('eligibility — Medicaid HCBS Waiver', () => {
  it('matches when age65plus + lowIncome (Medicaid-eligible)', () => {
    const results = eligibility({ ...NONE, age65plus: true, lowIncome: true })
    expect(results.map(r => r.key)).toContain('medicaid_hcbs_waiver')
  })

  it('does NOT match when income is not low', () => {
    const results = eligibility({ ...NONE, age65plus: true, lowIncome: false })
    expect(results.map(r => r.key)).not.toContain('medicaid_hcbs_waiver')
  })
})

describe('eligibility — VA Aid & Attendance', () => {
  it('matches when veteran + age65plus', () => {
    const results = eligibility({ ...NONE, veteran: true, age65plus: true })
    expect(results.map(r => r.key)).toContain('va_aid_attendance')
  })

  it('does NOT match non-veteran', () => {
    const results = eligibility({ ...NONE, veteran: false, age65plus: true })
    expect(results.map(r => r.key)).not.toContain('va_aid_attendance')
  })
})

describe('eligibility — PACE Program', () => {
  it('matches when age65plus + medicaidEnrolled', () => {
    const results = eligibility({ ...NONE, age65plus: true, medicaidEnrolled: true })
    expect(results.map(r => r.key)).toContain('pace_program')
  })

  it('does NOT match without Medicaid', () => {
    const results = eligibility({ ...NONE, age65plus: true, medicaidEnrolled: false })
    expect(results.map(r => r.key)).not.toContain('pace_program')
  })
})

describe('eligibility — SHIP Counseling', () => {
  it('matches when age65plus (always available to seniors)', () => {
    const results = eligibility({ ...NONE, age65plus: true })
    expect(results.map(r => r.key)).toContain('ship_counseling')
  })

  it('does NOT match for non-seniors', () => {
    const results = eligibility({ ...NONE, age65plus: false })
    expect(results.map(r => r.key)).not.toContain('ship_counseling')
  })
})

describe('eligibility — result shape', () => {
  it('each result has key, name, description, applyUrl', () => {
    const results = eligibility({ ...NONE, age65plus: true })
    for (const r of results) {
      expect(r).toHaveProperty('key')
      expect(r).toHaveProperty('name')
      expect(r).toHaveProperty('description')
      expect(r).toHaveProperty('applyUrl')
    }
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test benefitsEligibility.test
```

Expected: FAIL — `Cannot find module '../benefitsEligibility'`

- [ ] **Step 3: Write the eligibility function**

```ts
// apps/web/lib/benefitsEligibility.ts

export type ScreenerAnswers = {
  age65plus:        boolean
  veteran:          boolean
  lowIncome:        boolean
  medicareEnrolled: boolean
  medicaidEnrolled: boolean
}

export type BenefitProgram = {
  key:         string
  name:        string
  description: string
  applyUrl:    string
}

const PROGRAMS: Array<{ key: string; name: string; description: string; applyUrl: string; matches: (a: ScreenerAnswers) => boolean }> = [
  {
    key:         'medicare_part_d_extra_help',
    name:        'Medicare Part D Extra Help',
    description: 'Helps pay for prescription drug costs for people with limited income who are on Medicare.',
    applyUrl:    'https://www.ssa.gov/medicare/part-d',
    matches:     (a) => a.age65plus && a.lowIncome && a.medicareEnrolled,
  },
  {
    key:         'medicaid_hcbs_waiver',
    name:        'Medicaid Home & Community Based Services (HCBS) Waiver',
    description: 'Provides in-home care services for eligible low-income seniors to help them remain at home.',
    applyUrl:    'https://www.medicaid.gov/medicaid/hcbs/index.html',
    matches:     (a) => a.age65plus && a.lowIncome,
  },
  {
    key:         'va_aid_attendance',
    name:        'VA Aid & Attendance Benefit',
    description: 'Monthly pension benefit for eligible veterans who need help with daily activities.',
    applyUrl:    'https://www.va.gov/pension/aid-attendance-housebound/',
    matches:     (a) => a.veteran && a.age65plus,
  },
  {
    key:         'pace_program',
    name:        'PACE Program (Program of All-inclusive Care for the Elderly)',
    description: 'Coordinates all medical and social services for Medicaid-eligible seniors who want to stay in their community.',
    applyUrl:    'https://www.medicaid.gov/medicaid/ltss/pace/index.html',
    matches:     (a) => a.age65plus && a.medicaidEnrolled,
  },
  {
    key:         'ship_counseling',
    name:        'State Health Insurance Assistance Program (SHIP)',
    description: 'Free, unbiased Medicare counseling from trained counselors who help seniors understand their options.',
    applyUrl:    'https://www.shiphelp.org',
    matches:     (a) => a.age65plus,
  },
]

export function eligibility(answers: ScreenerAnswers): BenefitProgram[] {
  return PROGRAMS
    .filter(p => p.matches(answers))
    .map(({ key, name, description, applyUrl }) => ({ key, name, description, applyUrl }))
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test benefitsEligibility.test
```

Expected: all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/benefitsEligibility.ts apps/web/lib/__tests__/benefitsEligibility.test.ts
git commit -m "feat: benefitsEligibility pure function + tests (P5-02)"
```

---

## Task 3: tRPC router

**Files:**
- Create: `apps/web/server/routers/benefits.ts`

- [ ] **Step 1: Write the router**

```ts
// apps/web/server/routers/benefits.ts
import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/index'
import { TRPCError } from '@trpc/server'
import { supabaseAdmin } from '../supabaseAdmin.server'

const screenInput = z.object({
  org_id:       z.string().uuid(),
  recipient_id: z.string().uuid(),
  answers:      z.object({
    age65plus:        z.boolean(),
    veteran:          z.boolean(),
    lowIncome:        z.boolean(),
    medicareEnrolled: z.boolean(),
    medicaidEnrolled: z.boolean(),
  }),
  results: z.array(z.object({
    key:         z.string(),
    name:        z.string(),
    description: z.string(),
    applyUrl:    z.string(),
  })),
})

const latestInput = z.object({
  org_id:       z.string().uuid(),
  recipient_id: z.string().uuid(),
})

async function assertCoordinator(orgId: string, userId: string) {
  const { data: membership } = await supabaseAdmin
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .single()
  if (!membership || membership.role !== 'coordinator') {
    throw new TRPCError({ code: 'FORBIDDEN' })
  }
}

export const benefitsRouter = router({
  screen: protectedProcedure
    .input(screenInput)
    .mutation(async ({ ctx, input }) => {
      await assertCoordinator(input.org_id, ctx.user.id)
      const { error } = await supabaseAdmin
        .from('benefits_screenings')
        .insert({
          org_id:       input.org_id,
          recipient_id: input.recipient_id,
          answers:      input.answers,
          results:      input.results,
          created_by:   ctx.user.id,
        })
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { ok: true }
    }),

  latest: protectedProcedure
    .input(latestInput)
    .query(async ({ ctx, input }) => {
      await assertCoordinator(input.org_id, ctx.user.id)
      const { data, error } = await supabaseAdmin
        .from('benefits_screenings')
        .select('*')
        .eq('org_id', input.org_id)
        .eq('recipient_id', input.recipient_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (error && error.code !== 'PGRST116') {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }
      return data ?? null
    }),
})
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/routers/benefits.ts
git commit -m "feat: benefitsRouter (P5-02)"
```

---

## Task 4: Wire router

**Files:**
- Modify: `apps/web/server/trpc/router.ts`

- [ ] **Step 1: Add import and register**

Add after the last import line:
```ts
import { benefitsRouter } from '../routers/benefits'
```

Add to the `appRouter` object:
```ts
benefits: benefitsRouter,
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/trpc/router.ts
git commit -m "feat: wire benefitsRouter into appRouter (P5-02)"
```

---

## Task 5: BenefitsNavigator component

**Files:**
- Create: `apps/web/app/journal/[recipientId]/BenefitsNavigator.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/app/journal/[recipientId]/BenefitsNavigator.tsx
'use client'

import { useState } from 'react'
import { trpc } from '../../../lib/trpc'
import { eligibility, type ScreenerAnswers, type BenefitProgram } from '../../../lib/benefitsEligibility'

type Props = {
  orgId:           string
  recipientId:     string
  currentUserRole: string
}

const DEFAULT_ANSWERS: ScreenerAnswers = {
  age65plus:        false,
  veteran:          false,
  lowIncome:        false,
  medicareEnrolled: false,
  medicaidEnrolled: false,
}

export function BenefitsNavigator({ orgId, recipientId, currentUserRole }: Props) {
  // Hooks must be called unconditionally — role guard is applied after
  const [open,       setOpen]       = useState(false)
  const [answers,    setAnswers]    = useState<ScreenerAnswers>(DEFAULT_ANSWERS)
  const [results,    setResults]    = useState<BenefitProgram[] | null>(null)
  const [showForm,   setShowForm]   = useState(false)

  const utils = trpc.useUtils()

  const { data: latest } = trpc.benefits.latest.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: open && currentUserRole === 'coordinator' }
  )

  const screenMutation = trpc.benefits.screen.useMutation({
    onSuccess: () => utils.benefits.latest.invalidate(),
  })

  if (currentUserRole !== 'coordinator') return null

  function handleToggleAnswer(key: keyof ScreenerAnswers) {
    setAnswers(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleRunScreener() {
    const matched = eligibility(answers)
    setResults(matched)
    screenMutation.mutate({
      org_id:       orgId,
      recipient_id: recipientId,
      answers,
      results:      matched,
    })
  }

  const displayResults: BenefitProgram[] | null = results ?? (latest ? (latest.results as BenefitProgram[]) : null)

  const QUESTIONS: Array<{ key: keyof ScreenerAnswers; label: string }> = [
    { key: 'age65plus',        label: 'Is the care recipient 65 or older?' },
    { key: 'veteran',          label: 'Is the care recipient a U.S. veteran?' },
    { key: 'lowIncome',        label: 'Does the household have limited income?' },
    { key: 'medicareEnrolled', label: 'Is the care recipient enrolled in Medicare?' },
    { key: 'medicaidEnrolled', label: 'Is the care recipient enrolled in Medicaid?' },
  ]

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-gray-700">Benefits navigator</span>
        <svg
          className={'w-4 h-4 text-gray-400 transition-transform ' + (open ? 'rotate-180' : '')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 space-y-4">
          {!showForm && displayResults === null && (
            <div className="pt-3">
              <p className="text-sm text-gray-500 mb-3">
                Answer a few questions to find matching benefit programs for the care recipient.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="text-sm bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 transition-colors"
              >
                Start screener
              </button>
            </div>
          )}

          {!showForm && displayResults !== null && (
            <div className="pt-3 space-y-3">
              {displayResults.length === 0 ? (
                <p className="text-sm text-gray-500">No matching programs found based on the answers provided.</p>
              ) : (
                <>
                  <p className="text-xs font-medium text-gray-500">
                    {displayResults.length} matching {displayResults.length === 1 ? 'program' : 'programs'}
                    {latest && !results ? ' (from last screener)' : ''}
                  </p>
                  <ul className="space-y-2">
                    {displayResults.map((program: BenefitProgram) => (
                      <li key={program.key} className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-sm font-medium text-gray-800">{program.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{program.description}</p>
                        <a
                          href={program.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                        >
                          Learn how to apply →
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button
                type="button"
                onClick={() => { setShowForm(true); setResults(null); setAnswers(DEFAULT_ANSWERS) }}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Run screener again
              </button>
            </div>
          )}

          {showForm && (
            <div className="pt-3 space-y-3">
              <p className="text-xs font-medium text-gray-500">Eligibility screener</p>
              {QUESTIONS.map(q => (
                <label key={q.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers[q.key]}
                    onChange={() => handleToggleAnswer(q.key)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{q.label}</span>
                </label>
              ))}
              <button
                type="button"
                onClick={() => { handleRunScreener(); setShowForm(false) }}
                disabled={screenMutation.isPending}
                className="w-full text-sm bg-gray-900 text-white rounded-lg py-1.5 hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {screenMutation.isPending ? 'Saving...' : 'Find matching programs'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/journal/[recipientId]/BenefitsNavigator.tsx
git commit -m "feat: BenefitsNavigator component (P5-02)"
```

---

## Task 6: Component tests

**Files:**
- Create: `apps/web/app/journal/[recipientId]/__tests__/BenefitsNavigator.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
// apps/web/app/journal/[recipientId]/__tests__/BenefitsNavigator.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BenefitsNavigator } from '../BenefitsNavigator'

const {
  mockLatestUseQuery,
  mockScreenMutation,
  mockScreenMutate,
  mockInvalidate,
} = vi.hoisted(() => ({
  mockLatestUseQuery:  vi.fn(),
  mockScreenMutation:  vi.fn(),
  mockScreenMutate:    vi.fn(),
  mockInvalidate:      vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ benefits: { latest: { invalidate: mockInvalidate } } }),
    benefits: {
      latest:  { useQuery:    mockLatestUseQuery  },
      screen:  { useMutation: mockScreenMutation  },
    },
  },
}))

const ORG_ID = '10000000-0000-0000-0000-000000000001'
const REC_ID = '20000000-0000-0000-0000-000000000001'

const defaultProps = {
  orgId:           ORG_ID,
  recipientId:     REC_ID,
  currentUserRole: 'coordinator',
}

function renderPanel(overrides: Partial<typeof defaultProps> = {}) {
  return render(<BenefitsNavigator {...defaultProps} {...overrides} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLatestUseQuery.mockReturnValue({ data: null })
  mockScreenMutation.mockReturnValue({ mutate: mockScreenMutate, isPending: false })
})

describe('BenefitsNavigator — role gating', () => {
  it('returns null for caregiver', () => {
    const { container } = renderPanel({ currentUserRole: 'caregiver' })
    expect(container.firstChild).toBeNull()
  })

  it('returns null for supporter', () => {
    const { container } = renderPanel({ currentUserRole: 'supporter' })
    expect(container.firstChild).toBeNull()
  })
})

describe('BenefitsNavigator — collapsed state', () => {
  it('shows "Benefits navigator" button when collapsed', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /benefits navigator/i })).toBeInTheDocument()
  })
})

describe('BenefitsNavigator — expanded, no prior screening', () => {
  it('shows Start screener button when no prior results', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /benefits navigator/i }))
    expect(screen.getByRole('button', { name: /start screener/i })).toBeInTheDocument()
  })

  it('shows questions after clicking Start screener', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /benefits navigator/i }))
    fireEvent.click(screen.getByRole('button', { name: /start screener/i }))
    expect(screen.getByText(/65 or older/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /find matching programs/i })).toBeInTheDocument()
  })
})

describe('BenefitsNavigator — expanded, prior results available', () => {
  beforeEach(() => {
    mockLatestUseQuery.mockReturnValue({
      data: {
        answers: { age65plus: true, veteran: false, lowIncome: false, medicareEnrolled: false, medicaidEnrolled: false },
        results: [{ key: 'ship_counseling', name: 'State Health Insurance Assistance Program (SHIP)', description: 'Free counseling', applyUrl: 'https://www.shiphelp.org' }],
      },
    })
  })

  it('shows matching program from last screening', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /benefits navigator/i }))
    expect(screen.getByText(/State Health Insurance Assistance Program/i)).toBeInTheDocument()
  })

  it('shows run screener again option', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /benefits navigator/i }))
    expect(screen.getByRole('button', { name: /run screener again/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run and confirm pass**

```bash
pnpm test BenefitsNavigator.test
```

Expected: all 8 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/journal/[recipientId]/__tests__/BenefitsNavigator.test.tsx
git commit -m "test: BenefitsNavigator component tests (P5-02)"
```

---

## Task 7: Wire into JournalClient

**Files:**
- Modify: `apps/web/app/journal/[recipientId]/JournalClient.tsx`

- [ ] **Step 1: Add import**

After the `import { ExpensePanel }` line, add:
```ts
import { BenefitsNavigator } from './BenefitsNavigator'
```

- [ ] **Step 2: Render the panel**

After the `ExpensePanel` block, add:
```tsx
{currentUserRole === 'coordinator' && org && (
  <div className="mt-6">
    <BenefitsNavigator orgId={org.id} recipientId={recipientId} currentUserRole={currentUserRole} />
  </div>
)}
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/journal/[recipientId]/JournalClient.tsx
git commit -m "feat: render BenefitsNavigator in JournalClient (P5-02)"
```
