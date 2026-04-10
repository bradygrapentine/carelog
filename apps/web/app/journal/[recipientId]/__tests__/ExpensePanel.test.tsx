import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExpensePanel } from '../ExpensePanel'

const {
  mockListUseQuery,
  mockCreateMutation,
  mockDeleteMutation,
  mockCreateMutate,
  mockDeleteMutate,
  mockInvalidate,
} = vi.hoisted(() => ({
  mockListUseQuery:   vi.fn(),
  mockCreateMutation: vi.fn(),
  mockDeleteMutation: vi.fn(),
  mockCreateMutate:   vi.fn(),
  mockDeleteMutate:   vi.fn(),
  mockInvalidate:     vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ expenses: { list: { invalidate: mockInvalidate } } }),
    expenses: {
      list:   { useQuery:    mockListUseQuery   },
      create: { useMutation: mockCreateMutation },
      delete: { useMutation: mockDeleteMutation },
    },
  },
}))

const ORG_ID = '10000000-0000-0000-0000-000000000001'
const REC_ID = '20000000-0000-0000-0000-000000000001'

const sampleExpenses = [
  {
    id:           'expense-1',
    amount:       42.50,
    currency:     'USD',
    category:     'medication',
    description:  'Aspirin',
    paid_by_name: 'Brady',
    incurred_at:  '2026-04-09',
  },
]

const defaultProps = {
  orgId:           ORG_ID,
  recipientId:     REC_ID,
  currentUserRole: 'coordinator',
}

function renderPanel(overrides: Partial<typeof defaultProps> = {}) {
  return render(<ExpensePanel {...defaultProps} {...overrides} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListUseQuery.mockReturnValue({ data: [], isLoading: false })
  mockCreateMutation.mockReturnValue({ mutate: mockCreateMutate, isPending: false })
  mockDeleteMutation.mockReturnValue({ mutate: mockDeleteMutate, isPending: false })
})

describe('ExpensePanel — collapsed state', () => {
  it('shows collapsed "Shared expenses" button', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /shared expenses/i })).toBeInTheDocument()
  })

  it('does not show form initially', () => {
    renderPanel()
    expect(screen.queryByText(/log expense/i)).toBeNull()
  })
})

describe('ExpensePanel — expanded empty state', () => {
  it('shows "No expenses logged yet" when empty', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /shared expenses/i }))
    expect(screen.getByText(/no expenses logged yet/i)).toBeInTheDocument()
  })
})

describe('ExpensePanel — expanded with data', () => {
  beforeEach(() => {
    mockListUseQuery.mockReturnValue({ data: sampleExpenses, isLoading: false })
  })

  it('shows expense description', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /shared expenses/i }))
    expect(screen.getByText('Aspirin')).toBeInTheDocument()
  })

  it('shows formatted amount', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /shared expenses/i }))
    expect(screen.getByText('$42.50')).toBeInTheDocument()
  })

  it('shows delete button for coordinator', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /shared expenses/i }))
    expect(screen.getByRole('button', { name: /delete expense/i })).toBeInTheDocument()
  })

  it('hides delete button for supporter', () => {
    renderPanel({ currentUserRole: 'supporter' })
    fireEvent.click(screen.getByRole('button', { name: /shared expenses/i }))
    expect(screen.queryByRole('button', { name: /delete expense/i })).toBeNull()
  })
})

describe('ExpensePanel — role gating for form', () => {
  it('shows log form for coordinator', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /shared expenses/i }))
    expect(screen.getByRole('button', { name: /log expense/i })).toBeInTheDocument()
  })

  it('shows log form for caregiver', () => {
    renderPanel({ currentUserRole: 'caregiver' })
    fireEvent.click(screen.getByRole('button', { name: /shared expenses/i }))
    expect(screen.getByRole('button', { name: /log expense/i })).toBeInTheDocument()
  })

  it('hides log form for supporter', () => {
    renderPanel({ currentUserRole: 'supporter' })
    fireEvent.click(screen.getByRole('button', { name: /shared expenses/i }))
    expect(screen.queryByRole('button', { name: /log expense/i })).toBeNull()
  })
})
