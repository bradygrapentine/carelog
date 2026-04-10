// apps/web/app/journal/[recipientId]/__tests__/ShiftList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShiftList } from '../ShiftList'

const { mockUseQuery, mockUseMutation, mockMutate, mockInvalidate, mockUseUtils } = vi.hoisted(() => ({
  mockUseQuery:    vi.fn(),
  mockUseMutation: vi.fn(),
  mockMutate:      vi.fn(),
  mockInvalidate:  vi.fn(),
  mockUseUtils:    vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    shifts: {
      list:   { useQuery: mockUseQuery },
      cancel: { useMutation: mockUseMutation },
    },
    useUtils: mockUseUtils,
  },
}))

const ORG_ID     = '10000000-0000-0000-0000-000000000001'
const REC_ID     = '20000000-0000-0000-0000-000000000001'
const USER_A_ID  = 'aaaa0001-0000-0000-0000-000000000001'
const USER_B_ID  = 'bbbb0002-0000-0000-0000-000000000002'

const members = [
  { id: '1', role: 'coordinator', user_id: USER_A_ID, display_name: 'Alice', email: 'alice@test.com' },
  { id: '2', role: 'caregiver',   user_id: USER_B_ID, display_name: 'Bob',   email: 'bob@test.com' },
]

const defaultProps = {
  orgId:           ORG_ID,
  recipientId:     REC_ID,
  members,
  currentUserId:   USER_A_ID,
  currentUserRole: 'coordinator',
}

function makeShift(overrides: Record<string, unknown> = {}) {
  return {
    id:                '00000000-0000-0000-0000-000000000099',
    org_id:            ORG_ID,
    recipient_id:      REC_ID,
    assignee_user_id:  USER_B_ID,
    start_at:          '2026-04-10T09:00:00.000Z',
    end_at:            '2026-04-10T11:00:00.000Z',
    status:            'scheduled',
    notes:             null,
    created_by:        USER_A_ID,
    created_at:        '2026-04-09T00:00:00.000Z',
    ...overrides,
  }
}

function renderList(overrides: Partial<typeof defaultProps> = {}) {
  return render(<ShiftList {...defaultProps} {...overrides} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseMutation.mockReturnValue({ mutate: mockMutate, isPending: false })
  mockUseUtils.mockReturnValue({ shifts: { list: { invalidate: mockInvalidate } } })
})

// ─── empty state ──────────────────────────────────────────────────────────────

describe('ShiftList — empty state', () => {
  it('renders "No shifts scheduled" when list is empty', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false })
    renderList()
    expect(screen.getByText(/no shifts scheduled this week/i)).toBeInTheDocument()
  })
})

// ─── shift cards ──────────────────────────────────────────────────────────────

describe('ShiftList — shift cards', () => {
  it('renders shift cards with assignee names', () => {
    mockUseQuery.mockReturnValue({ data: [makeShift()], isLoading: false })
    renderList()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('scheduled')).toBeInTheDocument()
  })

  it('shows notes when present', () => {
    mockUseQuery.mockReturnValue({ data: [makeShift({ notes: 'Bring meds' })], isLoading: false })
    renderList()
    expect(screen.getByText('Bring meds')).toBeInTheDocument()
  })
})

// ─── "Your shift" label ──────────────────────────────────────────────────────

describe('ShiftList — Your shift label', () => {
  it('shows "Your shift" for current user\'s shifts', () => {
    mockUseQuery.mockReturnValue({ data: [makeShift({ assignee_user_id: USER_A_ID })], isLoading: false })
    renderList({ currentUserId: USER_A_ID })
    expect(screen.getByText('Your shift')).toBeInTheDocument()
  })

  it('does not show "Your shift" for other user\'s shifts', () => {
    mockUseQuery.mockReturnValue({ data: [makeShift({ assignee_user_id: USER_B_ID })], isLoading: false })
    renderList({ currentUserId: USER_A_ID })
    expect(screen.queryByText('Your shift')).not.toBeInTheDocument()
  })
})

// ─── cancel button ───────────────────────────────────────────────────────────

describe('ShiftList — cancel button', () => {
  it('shows cancel button for coordinator role', () => {
    mockUseQuery.mockReturnValue({ data: [makeShift()], isLoading: false })
    renderList({ currentUserRole: 'coordinator' })
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('hides cancel button for caregiver role', () => {
    mockUseQuery.mockReturnValue({ data: [makeShift()], isLoading: false })
    renderList({ currentUserRole: 'caregiver' })
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('hides cancel button for cancelled shifts', () => {
    mockUseQuery.mockReturnValue({ data: [makeShift({ status: 'cancelled' })], isLoading: false })
    renderList({ currentUserRole: 'coordinator' })
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('calls shifts.cancel.mutate with correct args when cancel is clicked', () => {
    const shiftId = '11111111-1111-1111-1111-111111111111'
    mockUseQuery.mockReturnValue({ data: [makeShift({ id: shiftId })], isLoading: false })
    renderList({ currentUserRole: 'coordinator' })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(mockMutate).toHaveBeenCalledWith({ id: shiftId, org_id: ORG_ID })
  })
})

// ─── week navigation ─────────────────────────────────────────────────────────

describe('ShiftList — week navigation', () => {
  it('renders prev and next week buttons', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false })
    renderList()
    expect(screen.getByRole('button', { name: /previous week/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next week/i })).toBeInTheDocument()
  })
})
