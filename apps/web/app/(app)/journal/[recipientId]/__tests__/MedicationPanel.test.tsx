// apps/web/app/journal/[recipientId]/__tests__/MedicationPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MedicationPanel } from '../MedicationPanel'
import { trpc } from '@/lib/trpc'

const { mockCreate, mockDelete, mockInvalidate } = vi.hoisted(() => ({
  mockCreate:     vi.fn(),
  mockDelete:     vi.fn(),
  mockInvalidate: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ medications: { list: { invalidate: mockInvalidate } } }),
    medications: {
      list:   { useQuery:    vi.fn() },
      create: { useMutation: vi.fn() },
      delete: { useMutation: vi.fn() },
    },
  },
}))

const ORG_ID = '10000000-0000-0000-0000-000000000001'
const REC_ID = '20000000-0000-0000-0000-000000000001'

const sampleMeds = [
  { id: 'med-1', drug_name: 'Lisinopril', dosage: '10mg', instructions: 'Take with food', pharmacy: null, supply_days_remaining: 5 },
  { id: 'med-2', drug_name: 'Metformin', dosage: '500mg', instructions: null, pharmacy: 'CVS', supply_days_remaining: 30 },
]

const coordinatorProps = {
  orgId:           ORG_ID,
  recipientId:     REC_ID,
  currentUserRole: 'coordinator',
}

const supporterProps = {
  orgId:           ORG_ID,
  recipientId:     REC_ID,
  currentUserRole: 'supporter',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(trpc.medications.list.useQuery).mockReturnValue({ data: undefined, isLoading: false } as any)
  vi.mocked(trpc.medications.create.useMutation).mockReturnValue({ mutate: mockCreate, isPending: false } as any)
  vi.mocked(trpc.medications.delete.useMutation).mockReturnValue({ mutate: mockDelete, isPending: false } as any)
})

// ─── collapsed state ───────────────────────────────────────────────────────────

describe('MedicationPanel — collapsed', () => {
  it('renders "Medications" button in collapsed state', () => {
    render(<MedicationPanel {...coordinatorProps} />)
    const btn = screen.getByRole('button', { name: /^medications$/i })
    expect(btn).toBeInTheDocument()
  })

  it('expands when "Medications" button clicked', () => {
    render(<MedicationPanel {...coordinatorProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^medications$/i }))
    expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument()
  })
})

// ─── loading / empty states ────────────────────────────────────────────────────

describe('MedicationPanel — loading and empty', () => {
  it('shows "Loading..." when isLoading is true and expanded', () => {
    vi.mocked(trpc.medications.list.useQuery).mockReturnValue({ data: undefined, isLoading: true } as any)
    render(<MedicationPanel {...coordinatorProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^medications$/i }))
    expect(screen.getByText(/loading\.\.\./i)).toBeInTheDocument()
  })

  it('shows "No medications added yet" when data is empty and expanded', () => {
    vi.mocked(trpc.medications.list.useQuery).mockReturnValue({ data: [], isLoading: false } as any)
    render(<MedicationPanel {...coordinatorProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^medications$/i }))
    expect(screen.getByText(/no medications added yet/i)).toBeInTheDocument()
  })
})

// ─── medication list ───────────────────────────────────────────────────────────

describe('MedicationPanel — medication list', () => {
  beforeEach(() => {
    vi.mocked(trpc.medications.list.useQuery).mockReturnValue({ data: sampleMeds, isLoading: false } as any)
  })

  it('shows medication name, dosage, and "Low supply" badge when supply_days_remaining <= 7', () => {
    render(<MedicationPanel {...coordinatorProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^medications$/i }))
    expect(screen.getByText('Lisinopril')).toBeInTheDocument()
    expect(screen.getByText('10mg')).toBeInTheDocument()
    expect(screen.getByText(/low supply/i)).toBeInTheDocument()
  })

  it('does NOT show "Low supply" badge when supply_days_remaining is 8+', () => {
    const highSupplyMed = [{ id: 'med-2', drug_name: 'Metformin', dosage: '500mg', instructions: null, pharmacy: 'CVS', supply_days_remaining: 30 }]
    vi.mocked(trpc.medications.list.useQuery).mockReturnValue({ data: highSupplyMed, isLoading: false } as any)
    render(<MedicationPanel {...coordinatorProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^medications$/i }))
    expect(screen.queryByText(/low supply/i)).not.toBeInTheDocument()
  })
})

// ─── coordinator-only controls ─────────────────────────────────────────────────

describe('MedicationPanel — coordinator controls', () => {
  it('shows "+ Add medication" button for coordinator', () => {
    vi.mocked(trpc.medications.list.useQuery).mockReturnValue({ data: [], isLoading: false } as any)
    render(<MedicationPanel {...coordinatorProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^medications$/i }))
    expect(screen.getByRole('button', { name: /\+ add medication/i })).toBeInTheDocument()
  })

  it('does NOT show "+ Add medication" button for supporter', () => {
    vi.mocked(trpc.medications.list.useQuery).mockReturnValue({ data: [], isLoading: false } as any)
    render(<MedicationPanel {...supporterProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^medications$/i }))
    expect(screen.queryByRole('button', { name: /\+ add medication/i })).not.toBeInTheDocument()
  })

  it('calls deleteMutation.mutate when "Remove" clicked (coordinator only)', () => {
    vi.mocked(trpc.medications.list.useQuery).mockReturnValue({ data: sampleMeds, isLoading: false } as any)
    render(<MedicationPanel {...coordinatorProps} />)
    fireEvent.click(screen.getByRole('button', { name: /^medications$/i }))
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    fireEvent.click(removeButtons[0])
    expect(mockDelete).toHaveBeenCalledWith({ id: 'med-1', org_id: ORG_ID })
  })
})
