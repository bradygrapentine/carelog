// apps/web/app/journal/[recipientId]/__tests__/ExportButton.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportButton } from '../ExportButton'

const { mockAuthenticatedFetch } = vi.hoisted(() => ({
  mockAuthenticatedFetch: vi.fn(),
}))

vi.mock('@/lib/authenticatedFetch', () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://fake')
global.URL.revokeObjectURL = vi.fn()

const ORG_ID = '10000000-0000-0000-0000-000000000001'
const REC_ID = '20000000-0000-0000-0000-000000000001'

const defaultProps = {
  orgId:           ORG_ID,
  recipientId:     REC_ID,
  currentUserRole: 'coordinator',
}

function renderButton(overrides: Partial<typeof defaultProps> = {}) {
  return render(<ExportButton {...defaultProps} {...overrides} />)
}

const okBlobResponse = {
  ok:   true,
  blob: () => Promise.resolve(new Blob(['data'])),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthenticatedFetch.mockResolvedValue(okBlobResponse)
})

describe('ExportButton — role gating', () => {
  it('returns null for caregiver role', () => {
    const { container } = renderButton({ currentUserRole: 'caregiver' })
    expect(container.firstChild).toBeNull()
  })

  it('returns null for supporter role', () => {
    const { container } = renderButton({ currentUserRole: 'supporter' })
    expect(container.firstChild).toBeNull()
  })
})

describe('ExportButton — coordinator render', () => {
  it('renders form with expected elements for coordinator', () => {
    renderButton()
    expect(screen.getByText('Export full history')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /json/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/from date/i)).toBeInTheDocument()
  })

  it('JSON button is aria-pressed=true by default, PDF is aria-pressed=false', () => {
    renderButton()
    expect(screen.getByRole('button', { name: /json/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /pdf/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking PDF flips aria-pressed state', () => {
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: /pdf/i }))
    expect(screen.getByRole('button', { name: /pdf/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /json/i })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('ExportButton — submit behaviour', () => {
  it('calls authenticatedFetch with correct body on submit', async () => {
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: /download export/i }))

    await waitFor(() => expect(mockAuthenticatedFetch).toHaveBeenCalledOnce())
    const [url, opts] = mockAuthenticatedFetch.mock.calls[0]
    expect(url).toBe('/api/export')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body).toMatchObject({ orgId: ORG_ID, recipientId: REC_ID, format: 'json' })
    expect(body.since).toBeUndefined()
  })

  it('includes since as ISO string when date is set', async () => {
    renderButton()
    const dateInput = screen.getByLabelText(/from date/i)
    fireEvent.change(dateInput, { target: { value: '2026-01-15' } })
    fireEvent.click(screen.getByRole('button', { name: /download export/i }))

    await waitFor(() => expect(mockAuthenticatedFetch).toHaveBeenCalledOnce())
    const body = JSON.parse(mockAuthenticatedFetch.mock.calls[0][1].body)
    expect(body.since).toBe(new Date('2026-01-15').toISOString())
  })

  it('shows "Preparing..." and disables button while loading', async () => {
    // Delay the fetch so we can observe the loading state
    mockAuthenticatedFetch.mockReturnValue(new Promise(() => {}))
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: /download export/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /preparing/i })).toBeDisabled()
    })
  })

  it('shows error alert when response is not ok', async () => {
    mockAuthenticatedFetch.mockResolvedValue({ ok: false })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: /download export/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent("The export didn't finish. Try again, or pick a smaller date range.")
    })
  })
})
