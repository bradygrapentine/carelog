/**
 * Unit tests for shiftTradeRequestsRepository — helper-layer state machine.
 *
 * RLS-level target-user enforcement is covered by the pgTAP companion:
 *   supabase/tests/shift_trade_requests_rls.test.sql  (shipped TD-20)
 *
 * These tests cover the JS helper layer: payload shapes, status mapping,
 * call ordering in acceptRequest, and expiry logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createRequest,
  respondToRequest,
  acceptRequest,
  forceOverride,
  expireStaleRequests,
} from '../shiftTradeRequestsRepository'

// ---------------------------------------------------------------------------
// Mock supabaseAdmin (used by acceptRequest, forceOverride, expireStaleRequests)
// ---------------------------------------------------------------------------

const mockFrom = vi.fn()

vi.mock('../../supabaseAdmin.server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// ---------------------------------------------------------------------------
// Chain builder helpers
// ---------------------------------------------------------------------------

type MockResult = { data: unknown; error: { message: string } | null }

/**
 * Build a fluent chain that resolves via `.single()`.
 * All intermediate chain methods return the same object.
 */
function makeSingleChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'update', 'insert', 'eq', 'lte', 'in', 'order']
  for (const m of methods) {
    chain[m] = () => chain
  }
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

/**
 * Build a fluent chain that resolves at the terminal await (no `.single()`).
 * Used for queries that don't call `.single()` — e.g. the shifts update in
 * acceptRequest step 3 and expireStaleRequests.
 */
function makeDirectChain(result: MockResult) {
  const chain: Record<string, unknown> & PromiseLike<MockResult> = {
    then: (resolve: (v: MockResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  } as Record<string, unknown> & PromiseLike<MockResult>
  const methods = ['update', 'eq', 'lte', 'select']
  for (const m of methods) {
    chain[m] = () => chain
  }
  return chain
}

/**
 * Build a fluent chain for insert → select → single.
 */
function makeInsertChain(result: MockResult) {
  const chain: Record<string, unknown> = {}
  chain.insert = () => chain
  chain.select = () => chain
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

// ---------------------------------------------------------------------------
// Build a mock RLS supabase client (for createRequest / respondToRequest)
// ---------------------------------------------------------------------------

function makeSupabaseClient(chain: Record<string, unknown>) {
  return { from: vi.fn().mockReturnValue(chain) }
}

// ---------------------------------------------------------------------------
// Fixture UUIDs — no PII/PHI
// ---------------------------------------------------------------------------

const REQUEST_ID   = 'aaaaaaaa-0001-0000-0000-000000000000'
const SHIFT_ID     = 'bbbbbbbb-0002-0000-0000-000000000000'
const ORG_ID       = 'cccccccc-0003-0000-0000-000000000000'
const USER_A       = 'dddddddd-0004-0000-0000-000000000000'  // requested_by
const USER_B       = 'eeeeeeee-0005-0000-0000-000000000000'  // target_user_id / accepting

const TRADE_ROW = {
  id: REQUEST_ID,
  shift_id: SHIFT_ID,
  org_id: ORG_ID,
  requested_by: USER_A,
  target_user_id: USER_B,
  status: 'open' as const,
  message: null,
  resolved_by: null,
  resolved_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  expires_at: '2026-01-02T00:00:00.000Z',
}

// ---------------------------------------------------------------------------
// beforeEach: reset all mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// (a) createRequest — builds the right insert payload
// ===========================================================================

describe('createRequest', () => {
  it('inserts with correct field mapping and returns the row', async () => {
    const insertChain = makeInsertChain({ data: TRADE_ROW, error: null })
    const supabase = makeSupabaseClient(insertChain)

    const result = await createRequest(supabase as never, {
      shiftId: SHIFT_ID,
      orgId: ORG_ID,
      requestedBy: USER_A,
      targetUserId: USER_B,
      message: 'Can you cover?',
    })

    expect(supabase.from).toHaveBeenCalledWith('shift_trade_requests')
    expect(result).toEqual(TRADE_ROW)
  })

  it('passes null for optional fields when omitted', async () => {
    // Capture the insert argument by spying on the chain
    let capturedPayload: unknown
    const chain: Record<string, unknown> = {
      insert: vi.fn((payload: unknown) => {
        capturedPayload = payload
        return chain
      }),
      select: () => chain,
      single: vi.fn().mockResolvedValue({ data: TRADE_ROW, error: null }),
    }
    const supabase = makeSupabaseClient(chain)

    await createRequest(supabase as never, {
      shiftId: SHIFT_ID,
      orgId: ORG_ID,
      requestedBy: USER_A,
    })

    expect(capturedPayload).toMatchObject({
      shift_id: SHIFT_ID,
      org_id: ORG_ID,
      requested_by: USER_A,
      target_user_id: null,
      message: null,
    })
  })

  it('throws when supabase returns an error', async () => {
    const insertChain = makeInsertChain({ data: null, error: { message: 'db error' } })
    const supabase = makeSupabaseClient(insertChain)

    await expect(
      createRequest(supabase as never, {
        shiftId: SHIFT_ID,
        orgId: ORG_ID,
        requestedBy: USER_A,
      }),
    ).rejects.toThrow('createRequest failed: db error')
  })
})

// ===========================================================================
// (b) respondToRequest — maps action → status and writes via RLS client
// ===========================================================================

describe('respondToRequest', () => {
  it.each([
    ['accept' as const, 'accepted'],
    ['decline' as const, 'declined'],
  ])('maps action "%s" to status "%s"', async (action, expectedStatus) => {
    let capturedUpdate: unknown
    const chain: Record<string, unknown> = {
      update: vi.fn((payload: unknown) => {
        capturedUpdate = payload
        return chain
      }),
      eq: () => chain,
      select: () => chain,
      single: vi.fn().mockResolvedValue({ data: { ...TRADE_ROW, status: expectedStatus }, error: null }),
    }
    const supabase = makeSupabaseClient(chain)

    const result = await respondToRequest(supabase as never, REQUEST_ID, USER_B, action)

    expect(capturedUpdate).toMatchObject({ status: expectedStatus, resolved_by: USER_B })
    expect(result.status).toBe(expectedStatus)
    // Verify the RLS client (not supabaseAdmin) was used
    expect(supabase.from).toHaveBeenCalledWith('shift_trade_requests')
    // supabaseAdmin.from should NOT have been called
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('throws on DB error', async () => {
    const chain: Record<string, unknown> = {
      update: () => chain,
      eq: () => chain,
      select: () => chain,
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'rls denied' } }),
    }
    const supabase = makeSupabaseClient(chain)

    await expect(
      respondToRequest(supabase as never, REQUEST_ID, USER_B, 'accept'),
    ).rejects.toThrow('respondToRequest failed: rls denied')
  })
})

// ===========================================================================
// (c) acceptRequest — ORDERING: fetch → status check → update trade → shift reassign
// ===========================================================================

describe('acceptRequest — happy path ordering', () => {
  it('calls fetch first, then trade update, then shift reassign — in that order', async () => {
    const callOrder: string[] = []

    // Step 1: fetch — returns open trade row
    const fetchChain: Record<string, unknown> = {
      select: () => fetchChain,
      eq: () => fetchChain,
      single: vi.fn().mockImplementation(async () => {
        callOrder.push('fetch')
        return { data: { id: REQUEST_ID, shift_id: SHIFT_ID, status: 'open' }, error: null }
      }),
    }

    // Step 2: trade update — returns updated trade row
    const tradeUpdateChain: Record<string, unknown> = {
      update: () => tradeUpdateChain,
      eq: () => tradeUpdateChain,
      select: () => tradeUpdateChain,
      single: vi.fn().mockImplementation(async () => {
        callOrder.push('trade-update')
        return { data: { ...TRADE_ROW, status: 'accepted', resolved_by: USER_B }, error: null }
      }),
    }

    // Step 3: shift reassign — no .single(), resolves directly
    const shiftUpdateChain: Record<string, unknown> & PromiseLike<MockResult> = {
      then: (resolve: (v: MockResult) => unknown, reject?: (e: unknown) => unknown) => {
        callOrder.push('shift-reassign')
        return Promise.resolve({ data: null, error: null }).then(resolve, reject)
      },
    } as Record<string, unknown> & PromiseLike<MockResult>
    shiftUpdateChain.update = () => shiftUpdateChain
    shiftUpdateChain.eq = () => shiftUpdateChain

    // mockFrom returns different chains by call index
    mockFrom
      .mockReturnValueOnce(fetchChain)        // call 1: fetch
      .mockReturnValueOnce(tradeUpdateChain)  // call 2: trade update
      .mockReturnValueOnce(shiftUpdateChain)  // call 3: shift reassign

    const result = await acceptRequest(REQUEST_ID, USER_B)

    // ORDER is the primary assertion
    expect(callOrder).toEqual(['fetch', 'trade-update', 'shift-reassign'])

    // Table names in correct order
    expect(mockFrom.mock.calls[0][0]).toBe('shift_trade_requests') // fetch
    expect(mockFrom.mock.calls[1][0]).toBe('shift_trade_requests') // trade update
    expect(mockFrom.mock.calls[2][0]).toBe('shifts')              // shift reassign

    expect(result.status).toBe('accepted')
  })
})

describe('acceptRequest — status mismatch short-circuits before shift mutation', () => {
  it('throws before touching shifts table when status !== "open"', async () => {
    const fetchChain: Record<string, unknown> = {
      select: () => fetchChain,
      eq: () => fetchChain,
      single: vi.fn().mockResolvedValue({
        data: { id: REQUEST_ID, shift_id: SHIFT_ID, status: 'accepted' },
        error: null,
      }),
    }

    mockFrom.mockReturnValueOnce(fetchChain)

    await expect(acceptRequest(REQUEST_ID, USER_B)).rejects.toThrow(
      'not open (status=accepted)',
    )

    // Only one from() call — the fetch. No trade update, no shift mutation.
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom.mock.calls[0][0]).toBe('shift_trade_requests')
  })
})

// ===========================================================================
// (d) acceptRequest — partial failure: shift reassign fails → error propagates
// ===========================================================================

describe('acceptRequest — partial failure', () => {
  it('propagates shift reassign error (does not silently swallow)', async () => {
    const fetchChain: Record<string, unknown> = {
      select: () => fetchChain,
      eq: () => fetchChain,
      single: vi.fn().mockResolvedValue({
        data: { id: REQUEST_ID, shift_id: SHIFT_ID, status: 'open' },
        error: null,
      }),
    }

    const tradeUpdateChain: Record<string, unknown> = {
      update: () => tradeUpdateChain,
      eq: () => tradeUpdateChain,
      select: () => tradeUpdateChain,
      single: vi.fn().mockResolvedValue({
        data: { ...TRADE_ROW, status: 'accepted', resolved_by: USER_B },
        error: null,
      }),
    }

    // Shift reassign step fails
    const failedShiftChain: Record<string, unknown> & PromiseLike<MockResult> = {
      then: (resolve: (v: MockResult) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: { message: 'shifts table locked' } }).then(resolve, reject),
    } as Record<string, unknown> & PromiseLike<MockResult>
    failedShiftChain.update = () => failedShiftChain
    failedShiftChain.eq = () => failedShiftChain

    mockFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(tradeUpdateChain)
      .mockReturnValueOnce(failedShiftChain)

    await expect(acceptRequest(REQUEST_ID, USER_B)).rejects.toThrow(
      'acceptRequest shift reassign failed: shifts table locked',
    )

    // Trade update DID occur (3 from() calls total)
    expect(mockFrom).toHaveBeenCalledTimes(3)
  })
})

// ===========================================================================
// (e) forceOverride — admin path, bypasses target check, uses supabaseAdmin
// ===========================================================================

describe('forceOverride', () => {
  const COORDINATOR_ID = 'ffffffff-0006-0000-0000-000000000000'

  it.each([
    ['accept' as const, 'accepted'],
    ['decline' as const, 'declined'],
    ['cancel' as const, 'cancelled'],
  ])('maps action "%s" to status "%s" via supabaseAdmin', async (action, expectedStatus) => {
    let capturedUpdate: unknown
    const chain: Record<string, unknown> = {
      update: vi.fn((payload: unknown) => {
        capturedUpdate = payload
        return chain
      }),
      eq: () => chain,
      select: () => chain,
      single: vi.fn().mockResolvedValue({
        data: { ...TRADE_ROW, status: expectedStatus, resolved_by: COORDINATOR_ID },
        error: null,
      }),
    }
    mockFrom.mockReturnValue(chain)

    const result = await forceOverride(REQUEST_ID, COORDINATOR_ID, ORG_ID, action)

    // Uses supabaseAdmin (mockFrom), NOT a passed-in RLS client
    expect(mockFrom).toHaveBeenCalledWith('shift_trade_requests')
    expect(capturedUpdate).toMatchObject({ status: expectedStatus, resolved_by: COORDINATOR_ID })
    expect(result.status).toBe(expectedStatus)
  })

  it('throws when supabaseAdmin returns an error', async () => {
    const chain: Record<string, unknown> = {
      update: () => chain,
      eq: () => chain,
      select: () => chain,
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'admin blocked' } }),
    }
    mockFrom.mockReturnValue(chain)

    await expect(
      forceOverride(REQUEST_ID, COORDINATOR_ID, ORG_ID, 'cancel'),
    ).rejects.toThrow('forceOverride failed: admin blocked')
  })
})

// ===========================================================================
// (f) expireStaleRequests — returns { expiredIds } for open rows past expires_at
// ===========================================================================

describe('expireStaleRequests', () => {
  it('returns expiredIds extracted from rows', async () => {
    const expiredRows = [
      { id: '11111111-0001-0000-0000-000000000000' },
      { id: '22222222-0002-0000-0000-000000000000' },
    ]

    const chain: Record<string, unknown> & PromiseLike<MockResult> = {
      then: (resolve: (v: MockResult) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: expiredRows, error: null }).then(resolve, reject),
    } as Record<string, unknown> & PromiseLike<MockResult>
    chain.update = () => chain
    chain.eq = () => chain
    chain.lte = () => chain
    chain.select = () => chain

    mockFrom.mockReturnValue(chain)

    const result = await expireStaleRequests()

    expect(mockFrom).toHaveBeenCalledWith('shift_trade_requests')
    expect(result).toEqual({
      expiredIds: [
        '11111111-0001-0000-0000-000000000000',
        '22222222-0002-0000-0000-000000000000',
      ],
    })
  })

  it('returns empty expiredIds when no stale rows exist', async () => {
    const chain: Record<string, unknown> & PromiseLike<MockResult> = {
      then: (resolve: (v: MockResult) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    } as Record<string, unknown> & PromiseLike<MockResult>
    chain.update = () => chain
    chain.eq = () => chain
    chain.lte = () => chain
    chain.select = () => chain

    mockFrom.mockReturnValue(chain)

    const result = await expireStaleRequests()
    expect(result).toEqual({ expiredIds: [] })
  })

  it('throws when supabaseAdmin returns an error', async () => {
    const chain: Record<string, unknown> & PromiseLike<MockResult> = {
      then: (resolve: (v: MockResult) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: { message: 'cron failed' } }).then(resolve, reject),
    } as Record<string, unknown> & PromiseLike<MockResult>
    chain.update = () => chain
    chain.eq = () => chain
    chain.lte = () => chain
    chain.select = () => chain

    mockFrom.mockReturnValue(chain)

    await expect(expireStaleRequests()).rejects.toThrow('expireStaleRequests failed: cron failed')
  })
})
