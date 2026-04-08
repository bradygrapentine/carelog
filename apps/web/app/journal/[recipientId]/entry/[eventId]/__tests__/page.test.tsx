import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockGetUser, mockFrom, mockAuthenticatedFetch } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn(() => {
    const chain: any = { select: () => chain, eq: () => chain }
    chain.single = vi.fn().mockResolvedValue({ data: { org_id: 'org-1' }, error: null })
    return chain
  })
  const mockAuthenticatedFetch = vi.fn()
  return { mockGetUser, mockFrom, mockAuthenticatedFetch }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}))

vi.mock('../../../../../../lib/supabase', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock('../../../../../../lib/authenticatedFetch', () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

import EntryDetailPage from '../page'

const RECIPIENT_ID = 'r1'
const EVENT_ID     = 'e1'
const USER_ID      = 'user-1'

function makeParams(rid = RECIPIENT_ID, eid = EVENT_ID) {
  return Promise.resolve({ recipientId: rid, eventId: eid })
}

function makeEvent(overrides: object = {}) {
  return {
    id: EVENT_ID,
    event_type: 'journal',
    entry_kind: 'human',
    occurred_at: new Date().toISOString(),
    flagged: false,
    payload: { text: 'Today was peaceful.' },
    ...overrides,
  }
}

function mockApis({
  user = { id: USER_ID } as object | null,
  events = [makeEvent()],
  members = [{ user_id: USER_ID, role: 'coordinator' }],
} = {}) {
  mockGetUser.mockResolvedValue({ data: { user } })

  mockAuthenticatedFetch.mockImplementation((url: string) => {
    if (url.includes('/api/journal')) {
      return Promise.resolve({ json: () => Promise.resolve({ events }) })
    }
    if (url.includes('/api/members')) {
      return Promise.resolve({ json: () => Promise.resolve({ members }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({}) })
  })

  // reactions fetch (plain fetch, not authenticatedFetch)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ counts: {}, myReaction: null }),
  }))
}

beforeEach(() => {
  vi.stubGlobal('location', { href: '' })
  mockGetUser.mockReset()
  mockAuthenticatedFetch.mockReset()
  mockFrom.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EntryDetailPage', () => {
  it('redirects to /signin when auth returns no user', async () => {
    mockApis({ user: null })
    await act(async () => {
      render(<EntryDetailPage params={makeParams()} />)
    })
    // Give effects time to settle
    await act(async () => {})
    expect(window.location.href).toBe('/signin')
  })

  it('redirects to /journal/{recipientId} when event is not in list', async () => {
    mockApis({ events: [] })
    await act(async () => {
      render(<EntryDetailPage params={makeParams()} />)
    })
    await act(async () => {})
    expect(window.location.href).toBe('/journal/' + RECIPIENT_ID)
  })

  it('renders event text when event is found', async () => {
    mockApis()
    await act(async () => {
      render(<EntryDetailPage params={makeParams()} />)
    })
    await act(async () => {})
    expect(screen.getByText('Today was peaceful.')).toBeInTheDocument()
  })

  it('shows flag button for coordinator role', async () => {
    mockApis({ members: [{ user_id: USER_ID, role: 'coordinator' }] })
    await act(async () => {
      render(<EntryDetailPage params={makeParams()} />)
    })
    await act(async () => {})
    expect(screen.getByRole('button', { name: /flag for doctor/i })).toBeInTheDocument()
  })

  it('does not show flag button for supporter role', async () => {
    mockApis({ members: [{ user_id: USER_ID, role: 'supporter' }] })
    await act(async () => {
      render(<EntryDetailPage params={makeParams()} />)
    })
    await act(async () => {})
    expect(screen.queryByRole('button', { name: /flag for doctor/i })).not.toBeInTheDocument()
  })
})
