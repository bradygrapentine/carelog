# Shift Creation UI (P2-02) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coordinator-only collapsible `ShiftForm` component to the journal page that calls the `shifts.create` tRPC mutation.

**Architecture:** `ShiftForm` is a self-contained client component that owns its own collapsed/expanded state and tRPC mutation. `JournalClient` conditionally renders it for coordinators between `TeamPanel` and `JournalTimeline`. No new state lives in `JournalClient`.

**Tech Stack:** Next.js 16 App Router, React, tRPC (`@trpc/react-query`), Zod (already in place), Tailwind CSS, Vitest + `@testing-library/react`.

---

## Key rules (read before writing any code)

- **ENTERPRISE_PRINCIPLES #1:** Never use template literals in JSX props. Compute values into variables before the JSX block.
- **ENTERPRISE_PRINCIPLES #5:** Read ALL form field values synchronously at the top of any async submit handler — before the first `await`. `e.currentTarget` becomes null after any `await`.
- **ENTERPRISE_PRINCIPLES #6:** Files with JSX must use `.tsx` extension.
- tRPC client import: `import { trpc } from '../../../lib/trpc'` (three levels up from the journal `[recipientId]` folder).
- Test runner: `pnpm exec vitest run <path>` from the repo root.

---

## File map

| Action | Path | Purpose |
|---|---|---|
| **Create** | `apps/web/app/journal/[recipientId]/ShiftForm.tsx` | Collapsible shift creation form |
| **Create** | `apps/web/app/journal/[recipientId]/__tests__/ShiftForm.test.tsx` | Vitest unit tests |
| **Modify** | `apps/web/app/journal/[recipientId]/JournalClient.tsx` | Render `<ShiftForm>` for coordinators |

---

## Task 1 — Write failing tests for ShiftForm

**Files:**
- Create: `apps/web/app/journal/[recipientId]/__tests__/ShiftForm.test.tsx`

- [ ] **Step 1.1: Create the test file**

```tsx
// apps/web/app/journal/[recipientId]/__tests__/ShiftForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShiftForm } from '../ShiftForm'

// vi.hoisted ensures mockMutateAsync is available inside the vi.mock factory,
// which is hoisted above all imports by Vitest.
const { mockMutateAsync, mockUseMutation } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockUseMutation: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    shifts: {
      create: {
        useMutation: mockUseMutation,
      },
    },
  },
}))

const ORG_ID = '10000000-0000-0000-0000-000000000001'
const REC_ID = '20000000-0000-0000-0000-000000000001'
const COORD_ID     = 'aaaa0001-0000-0000-0000-000000000001'
const CAREGIVER_ID = 'bbbb0002-0000-0000-0000-000000000002'
const SUPPORTER_ID = 'cccc0003-0000-0000-0000-000000000003'

const members = [
  { id: '1', role: 'coordinator', user_id: COORD_ID,     display_name: 'Alice', email: 'alice@test.com' },
  { id: '2', role: 'caregiver',   user_id: CAREGIVER_ID, display_name: 'Bob',   email: 'bob@test.com' },
  { id: '3', role: 'supporter',   user_id: SUPPORTER_ID, display_name: 'Carol', email: 'carol@test.com' },
]

const defaultProps = {
  members,
  recipientId: REC_ID,
  orgId:       ORG_ID,
  onSuccess:   vi.fn(),
}

function renderForm(overrides: Partial<typeof defaultProps> = {}) {
  return render(<ShiftForm {...defaultProps} {...overrides} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseMutation.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false })
})

// ─── collapsed state ──────────────────────────────────────────────────────────

describe('ShiftForm — collapsed', () => {
  it('renders a "+ Schedule a shift" trigger button when collapsed', () => {
    renderForm()
    expect(screen.getByRole('button', { name: /schedule a shift/i })).toBeInTheDocument()
  })

  it('expands the form when the trigger is clicked', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /schedule a shift/i }))
    expect(screen.getByRole('button', { name: /schedule shift/i })).toBeInTheDocument()
  })
})

// ─── assignee dropdown ────────────────────────────────────────────────────────

describe('ShiftForm — assignee dropdown', () => {
  beforeEach(() => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /schedule a shift/i }))
  })

  it('shows caregivers and coordinators in the assignee dropdown', () => {
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bob' })).toBeInTheDocument()
  })

  it('excludes supporters from the assignee dropdown', () => {
    expect(screen.queryByRole('option', { name: 'Carol' })).not.toBeInTheDocument()
  })
})

// ─── submit button state ──────────────────────────────────────────────────────

describe('ShiftForm — submit button', () => {
  beforeEach(() => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /schedule a shift/i }))
  })

  it('is disabled when no assignee is selected', () => {
    const submit = screen.getByRole('button', { name: /schedule shift/i })
    expect(submit).toBeDisabled()
  })

  it('is enabled once assignee and start time are filled', () => {
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '09:00' } })
    fireEvent.change(screen.getByRole('combobox', { name: /assignee/i }), { target: { value: CAREGIVER_ID } })
    expect(screen.getByRole('button', { name: /schedule shift/i })).not.toBeDisabled()
  })
})

// ─── custom duration ──────────────────────────────────────────────────────────

describe('ShiftForm — duration', () => {
  beforeEach(() => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /schedule a shift/i }))
  })

  it('hides end time input when a fixed duration is selected', () => {
    expect(screen.queryByLabelText(/end time/i)).not.toBeInTheDocument()
  })

  it('shows end time input when Custom duration is selected', () => {
    fireEvent.change(screen.getByRole('combobox', { name: /duration/i }), { target: { value: '0' } })
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument()
  })
})

// ─── form submission ──────────────────────────────────────────────────────────

describe('ShiftForm — submission', () => {
  function fillAndSubmit(durationValue = '2') {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /schedule a shift/i }))
    fireEvent.change(screen.getByLabelText(/date/i),       { target: { value: '2026-05-01' } })
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '09:00' } })
    fireEvent.change(screen.getByRole('combobox', { name: /duration/i }), { target: { value: durationValue } })
    fireEvent.change(screen.getByRole('combobox', { name: /assignee/i }), { target: { value: CAREGIVER_ID } })
  }

  it('calls shifts.create with correctly computed start_at and end_at for fixed duration', async () => {
    mockMutateAsync.mockResolvedValue({})
    fillAndSubmit('2')
    fireEvent.click(screen.getByRole('button', { name: /schedule shift/i }))
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce())
    const args = mockMutateAsync.mock.calls[0][0]
    expect(args.start_at).toBe('2026-05-01T09:00:00.000Z')
    expect(args.end_at).toBe('2026-05-01T11:00:00.000Z') // 09:00 + 2h
    expect(args.assignee_user_id).toBe(CAREGIVER_ID)
    expect(args.org_id).toBe(ORG_ID)
    expect(args.recipient_id).toBe(REC_ID)
  })

  it('collapses the form and calls onSuccess after successful submit', async () => {
    mockMutateAsync.mockResolvedValue({})
    const onSuccess = vi.fn()
    render(<ShiftForm {...defaultProps} onSuccess={onSuccess} />)
    fireEvent.click(screen.getByRole('button', { name: /schedule a shift/i }))
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '09:00' } })
    fireEvent.change(screen.getByRole('combobox', { name: /assignee/i }), { target: { value: CAREGIVER_ID } })
    fireEvent.click(screen.getByRole('button', { name: /schedule shift/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: /schedule a shift/i })).toBeInTheDocument()
  })

  it('shows conflict error message when CONFLICT TRPCError is thrown', async () => {
    mockMutateAsync.mockRejectedValue({ data: { code: 'CONFLICT' } })
    fillAndSubmit('1')
    fireEvent.click(screen.getByRole('button', { name: /schedule shift/i }))
    await waitFor(() =>
      expect(screen.getByText(/already has a shift at that time/i)).toBeInTheDocument()
    )
  })

  it('shows generic error message for non-CONFLICT errors', async () => {
    mockMutateAsync.mockRejectedValue({ data: { code: 'INTERNAL_SERVER_ERROR' } })
    fillAndSubmit('1')
    fireEvent.click(screen.getByRole('button', { name: /schedule shift/i }))
    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 1.2: Run tests — verify RED**

```bash
pnpm exec vitest run apps/web/app/journal/[recipientId]/__tests__/ShiftForm.test.tsx
```

Expected: FAIL — `Cannot find module '../ShiftForm'`. All tests fail because the component doesn't exist yet.

- [ ] **Step 1.3: Commit the test file**

```bash
git add apps/web/app/journal/[recipientId]/__tests__/ShiftForm.test.tsx
git commit -m "test(p2-02): write failing ShiftForm tests"
```

---

## Task 2 — Implement ShiftForm

**Files:**
- Create: `apps/web/app/journal/[recipientId]/ShiftForm.tsx`

- [ ] **Step 2.1: Create the component**

```tsx
// apps/web/app/journal/[recipientId]/ShiftForm.tsx
'use client'

import { useState } from 'react'
import { trpc } from '../../../lib/trpc'

// Duration options: value '0' means Custom (user provides end time directly)
const DURATION_OPTIONS = [
  { label: '1 hour',  value: '1' },
  { label: '2 hours', value: '2' },
  { label: '4 hours', value: '4' },
  { label: '8 hours', value: '8' },
  { label: 'Custom',  value: '0' },
]

interface Member {
  id:           string
  role:         string
  user_id:      string
  display_name: string | null
  email:        string | null
}

interface Props {
  members:     Member[]
  recipientId: string
  orgId:       string
  onSuccess:   () => void
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function addHoursToIso(date: string, time: string, hours: number): string {
  const startMs = new Date(date + 'T' + time + ':00').getTime()
  return new Date(startMs + hours * 3_600_000).toISOString()
}

export function ShiftForm({ members, recipientId, orgId, onSuccess }: Props) {
  const [expanded,   setExpanded]   = useState(false)
  const [date,       setDate]       = useState(todayDate)
  const [startTime,  setStartTime]  = useState('')
  const [duration,   setDuration]   = useState('1')
  const [endTime,    setEndTime]    = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [notes,      setNotes]      = useState('')
  const [error,      setError]      = useState<string | null>(null)

  const createMutation = trpc.shifts.create.useMutation()

  // Supporters cannot be shift assignees
  const assignableMembers = members.filter(m => m.role !== 'supporter')
  const isCustom  = duration === '0'
  const canSubmit = !!assigneeId && !!startTime && !createMutation.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Read ALL form values synchronously before any await — ENTERPRISE_PRINCIPLES #5
    const d   = date
    const st  = startTime
    const dur = duration
    const et  = endTime
    const aId = assigneeId
    const n   = notes.trim() || undefined

    const startAt = new Date(d + 'T' + st + ':00').toISOString()
    const endAt   = dur === '0'
      ? new Date(d + 'T' + et + ':00').toISOString()
      : addHoursToIso(d, st, parseInt(dur, 10))

    setError(null)
    try {
      await createMutation.mutateAsync({
        org_id:           orgId,
        recipient_id:     recipientId,
        assignee_user_id: aId,
        start_at:         startAt,
        end_at:           endAt,
        notes:            n,
      })
      setExpanded(false)
      setDate(todayDate())
      setStartTime('')
      setDuration('1')
      setEndTime('')
      setAssigneeId('')
      setNotes('')
      onSuccess()
    } catch (err: unknown) {
      const code = (err as { data?: { code?: string } })?.data?.code
      if (code === 'CONFLICT') {
        setError('This person already has a shift at that time.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    }
  }

  if (!expanded) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          + Schedule a shift
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <form onSubmit={handleSubmit} className="px-4 py-4">
        <p className="text-sm font-medium text-gray-700 mb-4">Schedule a shift</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label htmlFor="shift-date" className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              id="shift-date"
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setError(null) }}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label htmlFor="shift-start" className="block text-xs text-gray-500 mb-1">Start time</label>
            <input
              id="shift-start"
              type="time"
              step="1800"
              value={startTime}
              onChange={e => { setStartTime(e.target.value); setError(null) }}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label htmlFor="shift-duration" className="block text-xs text-gray-500 mb-1">Duration</label>
            <select
              id="shift-duration"
              value={duration}
              onChange={e => { setDuration(e.target.value); setError(null) }}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
            >
              {DURATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {isCustom && (
            <div>
              <label htmlFor="shift-end" className="block text-xs text-gray-500 mb-1">End time</label>
              <input
                id="shift-end"
                type="time"
                value={endTime}
                onChange={e => { setEndTime(e.target.value); setError(null) }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
              />
            </div>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="shift-assignee" className="block text-xs text-gray-500 mb-1">Assignee</label>
          <select
            id="shift-assignee"
            value={assigneeId}
            onChange={e => { setAssigneeId(e.target.value); setError(null) }}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
          >
            <option value="">Select a caregiver...</option>
            {assignableMembers.map(m => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name ?? m.email ?? m.user_id}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="shift-notes" className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
          <textarea
            id="shift-notes"
            value={notes}
            onChange={e => { setNotes(e.target.value); setError(null) }}
            maxLength={2000}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setExpanded(false); setError(null) }}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMutation.isPending ? 'Scheduling...' : 'Schedule shift'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2.2: Run tests — verify GREEN**

```bash
pnpm exec vitest run apps/web/app/journal/[recipientId]/__tests__/ShiftForm.test.tsx
```

Expected: All tests pass.

> **Note on `start_at` ISO string:** The test expects `2026-05-01T09:00:00.000Z`. This assumes the test environment's timezone is UTC. If tests fail with a timezone offset, wrap the date construction as: `new Date(d + 'T' + st + ':00Z').toISOString()` — use the `Z` suffix to force UTC. Match whatever the test environment produces.

- [ ] **Step 2.3: Commit**

```bash
git add apps/web/app/journal/[recipientId]/ShiftForm.tsx
git commit -m "feat(p2-02): add ShiftForm component"
```

---

## Task 3 — Wire ShiftForm into JournalClient

**Files:**
- Modify: `apps/web/app/journal/[recipientId]/JournalClient.tsx`

- [ ] **Step 3.1: Add the import and conditional render**

In `JournalClient.tsx`, make two changes:

**Change 1** — add import after the existing component imports (around line 9):
```tsx
import { ShiftForm } from './ShiftForm'
```

**Change 2** — add the `<ShiftForm>` block between the `<TeamPanel>` closing `</div>` and the `<JournalTimeline>` opening `<div>` (around line 154). The section currently looks like:

```tsx
        <div className="mt-6">
          <TeamPanel ... />
        </div>
        <div className="mt-6">
          <JournalTimeline ... />
        </div>
```

Replace with:

```tsx
        <div className="mt-6">
          <TeamPanel
            members={members}
            currentUserId={user?.id ?? ''}
            canInvite={currentUserRole === 'coordinator'}
            onInvite={handleInvite}
            showInvite={showInvite}
            onToggleInvite={() => setShowInvite(v => !v)}
          />
        </div>
        {currentUserRole === 'coordinator' && org && (
          <div className="mt-6">
            <ShiftForm
              members={members}
              recipientId={recipientId}
              orgId={org.id}
              onSuccess={() => {}}
            />
          </div>
        )}
        <div className="mt-6">
          <JournalTimeline
            events={events}
            currentUserId={user?.id ?? ''}
            canFlag={currentUserRole !== 'supporter'}
            recipientId={recipientId}
            onFlag={handleFlag}
          />
        </div>
```

- [ ] **Step 3.2: Run the full test suite**

```bash
pnpm exec vitest run
```

Expected: All tests pass (122 existing + new ShiftForm tests).

- [ ] **Step 3.3: Commit**

```bash
git add apps/web/app/journal/[recipientId]/JournalClient.tsx
git commit -m "feat(p2-02): render ShiftForm for coordinators on journal page"
```

---

## Self-review checklist (for agent)

After completing all tasks, verify against the spec:

- [ ] Coordinator sees `+ Schedule a shift` button — ✓ (ShiftForm rendered for coordinator role)
- [ ] Supporters do not see form — ✓ (`currentUserRole === 'coordinator'` guard in JournalClient)
- [ ] Assignee dropdown excludes supporters — ✓ (`members.filter(m => m.role !== 'supporter')`)
- [ ] Date + start time + duration (1h/2h/4h/8h/Custom) — ✓
- [ ] Custom duration shows end time input — ✓ (`isCustom` state)
- [ ] All form values read before `await` — ✓ (variables `d`, `st`, `dur`, etc.)
- [ ] No template literals in JSX props — ✓ (all className strings are static)
- [ ] CONFLICT error shown inline — ✓
- [ ] Generic error shown inline — ✓
- [ ] Form collapses and `onSuccess` called on success — ✓
- [ ] `onSuccess` is a no-op `() => {}` (P2-03 wires the list refresh later) — ✓
