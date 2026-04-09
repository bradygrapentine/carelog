// apps/web/app/journal/[recipientId]/__tests__/MedicationChecklist.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MedicationChecklist } from '../MedicationChecklist'
import { trpc } from '@/lib/trpc'

const { mockLog, mockInvalidate } = vi.hoisted(() => ({
  mockLog:        vi.fn(),
  mockInvalidate: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      medications: {
        listScheduled: { invalidate: mockInvalidate },
        todayLog:      { invalidate: mockInvalidate },
      },
    }),
    medications: {
      listScheduled:     { useQuery: vi.fn() },
      todayLog:          { useQuery: vi.fn() },
      logAdministration: { useMutation: vi.fn() },
    },
  },
}))

const ORG_ID = '10000000-0000-0000-0000-000000000001'
const REC_ID = '20000000-0000-0000-0000-000000000001'

const sampleSchedules = [
  {
    id: 'sched-1',
    scheduled_time: '08:00:00',
    medications: [{ id: 'med-1', drug_name: 'Lisinopril', dosage: '10mg' }],
  },
]

const defaultProps = {
  orgId:           ORG_ID,
  recipientId:     REC_ID,
  currentUserRole: 'coordinator',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({ data: sampleSchedules } as any)
  vi.mocked(trpc.medications.todayLog.useQuery).mockReturnValue({ data: [] } as any)
  vi.mocked(trpc.medications.logAdministration.useMutation).mockReturnValue({ mutate: mockLog, isPending: false } as any)
})

// ─── null / empty state ────────────────────────────────────────────────────────

describe('MedicationChecklist — null state', () => {
  it('returns null (renders nothing) when no schedules', () => {
    vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({ data: [] } as any)
    const { container } = render(<MedicationChecklist {...defaultProps} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when schedules is undefined', () => {
    vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({ data: undefined } as any)
    const { container } = render(<MedicationChecklist {...defaultProps} />)
    expect(container.firstChild).toBeNull()
  })
})

// ─── rendered list ─────────────────────────────────────────────────────────────

describe('MedicationChecklist — rendered list', () => {
  it('shows "Today\'s medications" header when schedules exist', () => {
    render(<MedicationChecklist {...defaultProps} />)
    expect(screen.getByText(/today's medications/i)).toBeInTheDocument()
  })

  it('shows medication label: Lisinopril 10mg — 08:00:00', () => {
    render(<MedicationChecklist {...defaultProps} />)
    expect(screen.getByText('Lisinopril 10mg — 08:00:00')).toBeInTheDocument()
  })

  it('both "Gave it" and "Missed" buttons are enabled for coordinator with no logs', () => {
    render(<MedicationChecklist {...defaultProps} />)
    const gaveBtn   = screen.getByRole('button', { name: /gave it/i })
    const missedBtn = screen.getByRole('button', { name: /missed/i })
    expect(gaveBtn).not.toBeDisabled()
    expect(missedBtn).not.toBeDisabled()
  })
})

// ─── disabled states ───────────────────────────────────────────────────────────

describe('MedicationChecklist — disabled states', () => {
  it('both buttons are disabled when medication is already logged', () => {
    vi.mocked(trpc.medications.todayLog.useQuery).mockReturnValue({
      data: [{ medication_id: 'med-1', scheduled_time: '08:00:00', action: 'given' }],
    } as any)
    render(<MedicationChecklist {...defaultProps} />)
    expect(screen.getByRole('button', { name: /gave it/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /missed/i })).toBeDisabled()
  })

  it('both buttons are disabled for supporter regardless of log state', () => {
    render(<MedicationChecklist {...defaultProps} currentUserRole="supporter" />)
    expect(screen.getByRole('button', { name: /gave it/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /missed/i })).toBeDisabled()
  })
})

// ─── mutation ─────────────────────────────────────────────────────────────────

describe('MedicationChecklist — mutation', () => {
  it('calls logAdministration.mutate with action: "given" when "Gave it" clicked', () => {
    render(<MedicationChecklist {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /gave it/i }))
    expect(mockLog).toHaveBeenCalledWith({
      org_id:         ORG_ID,
      recipient_id:   REC_ID,
      medication_id:  'med-1',
      scheduled_time: '08:00:00',
      action:         'given',
    })
  })
})
