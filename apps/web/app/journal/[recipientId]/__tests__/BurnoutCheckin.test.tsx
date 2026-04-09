// apps/web/app/journal/[recipientId]/__tests__/BurnoutCheckin.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BurnoutCheckin } from '../BurnoutCheckin'

const {
  mockCheckInMutate,
  mockCheckInMutation,
} = vi.hoisted(() => ({
  mockCheckInMutate:   vi.fn(),
  mockCheckInMutation: vi.fn(),
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    burnout: {
      checkIn: { useMutation: mockCheckInMutation },
    },
  },
}))

const ORG_ID  = '10000000-0000-0000-0000-000000000001'
const USER_ID = '20000000-0000-0000-0000-000000000001'

const defaultProps = {
  orgId:           ORG_ID,
  currentUserRole: 'coordinator',
  currentUserId:   USER_ID,
}

function renderCheckin(overrides: Partial<typeof defaultProps> = {}) {
  return render(<BurnoutCheckin {...defaultProps} {...overrides} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckInMutation.mockReturnValue({ mutate: mockCheckInMutate, isPending: false })
})

describe('BurnoutCheckin — role gating', () => {
  it('returns null for supporter role', () => {
    const { container } = renderCheckin({ currentUserRole: 'supporter' })
    expect(container.firstChild).toBeNull()
  })

  it('returns null for aide role', () => {
    const { container } = renderCheckin({ currentUserRole: 'aide' })
    expect(container.firstChild).toBeNull()
  })
})

describe('BurnoutCheckin — coordinator renders', () => {
  it('renders with "How are you doing this week?" heading for coordinator', () => {
    renderCheckin()
    expect(screen.getByText(/how are you doing this week\?/i)).toBeInTheDocument()
  })

  it('renders three range sliders for coordinator', () => {
    renderCheckin()
    expect(screen.getByLabelText(/sleep quality/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/stress level/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/support from others/i)).toBeInTheDocument()
  })
})

describe('BurnoutCheckin — form submission', () => {
  it('calls burnout.checkIn.mutate on submit with correct fields including week_stamp format', async () => {
    renderCheckin()

    // Adjust sliders
    fireEvent.change(screen.getByLabelText(/sleep quality/i), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText(/stress level/i),  { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/support from others/i), { target: { value: '5' } })

    fireEvent.click(screen.getByRole('button', { name: /save check-in/i }))

    await waitFor(() => expect(mockCheckInMutate).toHaveBeenCalledOnce())
    const call = mockCheckInMutate.mock.calls[0][0]
    expect(call).toMatchObject({
      org_id:        ORG_ID,
      user_id:       USER_ID,
      sleep_score:   4,
      stress_score:  2,
      support_score: 5,
    })
    // week_stamp must match YYYY-Www format
    expect(call.week_stamp).toMatch(/^\d{4}-W\d{2}$/)
  })

  it('shows "Saved!" confirmation text after successful mutation', async () => {
    // Simulate onSuccess being called by capturing and invoking the callback
    let successCb: (() => void) | undefined
    mockCheckInMutation.mockImplementation(({ onSuccess }: { onSuccess: () => void }) => {
      successCb = onSuccess
      return { mutate: mockCheckInMutate, isPending: false }
    })

    renderCheckin()
    fireEvent.click(screen.getByRole('button', { name: /save check-in/i }))

    // Trigger the success callback
    successCb?.()

    await waitFor(() =>
      expect(screen.getByText(/check-in saved/i)).toBeInTheDocument()
    )
  })
})
