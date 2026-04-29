// apps/web/app/journal/[recipientId]/__tests__/OcrReviewPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OcrReviewPanel } from '../OcrReviewPanel'

const { mockAuthFetch, mockToastError } = vi.hoisted(() => ({
  mockAuthFetch: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('@/lib/authenticatedFetch', () => ({
  authenticatedFetch: mockAuthFetch,
}))

vi.mock('sonner', () => ({
  toast: { error: mockToastError, success: vi.fn() },
}))

const ORG_ID = '10000000-0000-0000-0000-000000000001'
const REC_ID = '20000000-0000-0000-0000-000000000001'

const sampleJob = {
  id:             'job-1',
  recipient_id:   REC_ID,
  image_url:      'https://example.com/image.jpg',
  raw_text:       'Amoxicillin 500mg',
  parsed_payload: {
    drug_name:    'Amoxicillin',
    dosage:       '500mg',
    instructions: 'Take with food',
  },
  created_at: '2026-04-09T00:00:00Z',
}

const defaultProps = {
  orgId:       ORG_ID,
  recipientId: REC_ID,
}

function makeJsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

beforeEach(() => {
  vi.clearAllMocks()
  mockToastError.mockClear()
})

describe('OcrReviewPanel — initial state', () => {
  it('shows "Scan label" upload button initially', async () => {
    mockAuthFetch.mockResolvedValue(makeJsonResponse({ jobs: [] }))
    render(<OcrReviewPanel {...defaultProps} />)
    expect(screen.getByRole('button', { name: /scan label/i })).toBeInTheDocument()
  })

  it('shows "No scans pending review" empty state when no jobs', async () => {
    mockAuthFetch.mockResolvedValue(makeJsonResponse({ jobs: [] }))
    render(<OcrReviewPanel {...defaultProps} />)
    await waitFor(() =>
      expect(screen.getByText(/no scans pending review/i)).toBeInTheDocument()
    )
  })

  it('shows loading state before data arrives', () => {
    // Never resolves during this test
    mockAuthFetch.mockReturnValue(new Promise(() => {}))
    render(<OcrReviewPanel {...defaultProps} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})

describe('OcrReviewPanel — review card', () => {
  beforeEach(() => {
    mockAuthFetch.mockResolvedValue(makeJsonResponse({ jobs: [sampleJob] }))
  })

  it('renders a pending review card with editable drug_name field', async () => {
    render(<OcrReviewPanel {...defaultProps} />)
    await waitFor(() => expect(screen.getByDisplayValue('Amoxicillin')).toBeInTheDocument())
    const drugInput = screen.getByDisplayValue('Amoxicillin')
    expect(drugInput).toBeInTheDocument()
    fireEvent.change(drugInput, { target: { value: 'Amoxicillin XR' } })
    expect(screen.getByDisplayValue('Amoxicillin XR')).toBeInTheDocument()
  })

  it('renders dosage and instructions fields', async () => {
    render(<OcrReviewPanel {...defaultProps} />)
    await waitFor(() => expect(screen.getByDisplayValue('500mg')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Take with food')).toBeInTheDocument()
  })
})

describe('OcrReviewPanel — upload error toast', () => {
  it('fires toast.error with action when upload fetch throws', async () => {
    // First call = initial loadJobs, second call = upload throws
    mockAuthFetch
      .mockResolvedValueOnce(makeJsonResponse({ jobs: [] }))
      .mockRejectedValueOnce(new Error('network error'))

    render(<OcrReviewPanel {...defaultProps} />)
    await waitFor(() =>
      expect(screen.getByText(/no scans pending review/i)).toBeInTheDocument()
    )

    // Simulate file upload by firing change on the hidden input
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['dummy'], 'label.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => expect(mockToastError).toHaveBeenCalledOnce())
    const [message, opts] = mockToastError.mock.calls[0]
    expect(message).toMatch(/upload failed/i)
    expect(opts).toMatchObject({ action: { label: 'Try again' } })
    expect(typeof opts.action.onClick).toBe('function')
  })
})

describe('OcrReviewPanel — confirm and discard', () => {
  beforeEach(() => {
    // First call = load jobs, subsequent calls = confirm/discard
    mockAuthFetch.mockResolvedValueOnce(makeJsonResponse({ jobs: [sampleJob] }))
  })

  it('clicking "Confirm" calls authenticatedFetch to /api/ocr/confirm', async () => {
    mockAuthFetch.mockResolvedValue(makeJsonResponse({ ok: true }))
    render(<OcrReviewPanel {...defaultProps} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalledWith(
      '/api/ocr/confirm',
      expect.objectContaining({ method: 'POST' })
    ))
  })

  it('clicking "Discard" calls authenticatedFetch to /api/ocr/discard', async () => {
    mockAuthFetch.mockResolvedValue(makeJsonResponse({ ok: true }))
    render(<OcrReviewPanel {...defaultProps} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /discard/i }))
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalledWith(
      '/api/ocr/discard',
      expect.objectContaining({ method: 'POST' })
    ))
  })

  it('removes job from list after successful confirm', async () => {
    mockAuthFetch.mockResolvedValue(makeJsonResponse({}, true))
    render(<OcrReviewPanel {...defaultProps} />)
    await waitFor(() => expect(screen.getByDisplayValue('Amoxicillin')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() =>
      expect(screen.getByText(/no scans pending review/i)).toBeInTheDocument()
    )
  })
})
