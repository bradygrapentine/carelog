import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}))
vi.mock('@/server/repositories/membershipsRepository', () => ({
  getMemberships: vi.fn(),
  createMembershipAndInvite: vi.fn(),
}))
vi.mock('@/server/repositories/careEventsRepository', () => ({
  getTimeline: vi.fn(), insertEvent: vi.fn(), getFlaggedEvents: vi.fn(), insertEventIdempotent: vi.fn(),
}))
vi.mock('@/server/repositories/organizationsRepository', () => ({
  getOrganization: vi.fn(), createOrganization: vi.fn(), getUserOrganizations: vi.fn(),
}))
vi.mock('@/server/repositories/identityRepository', () => ({
  createIdentity: vi.fn(),
}))

import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { appRouter } from '@/server/trpc/router'

const ORG_ID      = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const USER_ID     = '28dc6d19-6712-4b26-8797-b4e544e01b85'
const OTHER_USER  = '38dc6d19-6712-4b26-8797-b4e544e01b86'
const WEEK_STAMP  = '2026-W15'

const authedCaller = appRouter.createCaller({
  user:     { id: USER_ID, email: 'user@example.com' } as any,
  supabase: { from: vi.fn() } as any,
  req:      undefined,
})

function makeSelectChain(result: object) {
  const chain: any = {
    select:  () => chain,
    eq:      () => chain,
    not:     () => chain,
    order:   () => chain,
    limit:   vi.fn().mockResolvedValue(result),
  }
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

function makeUpsertChain(result: object) {
  return { upsert: vi.fn().mockResolvedValue(result) } as any
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
})

// ─── burnout.checkIn ──────────────────────────────────────────────────────────

describe('burnout.checkIn — authorization', () => {
  const checkInBase = {
    org_id:        ORG_ID,
    user_id:       USER_ID,
    sleep_score:   3,
    stress_score:  3,
    support_score: 3,
    week_stamp:    WEEK_STAMP,
  }

  it('throws FORBIDDEN when input.user_id !== ctx.user.id', async () => {
    await expect(
      authedCaller.burnout.checkIn({ ...checkInBase, user_id: OTHER_USER })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('succeeds when user_id matches ctx.user.id', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeUpsertChain({ error: null }))
    const result = await authedCaller.burnout.checkIn(checkInBase)
    expect(result).toEqual({ upserted: true })
  })
})

// ─── burnout.orgSummary — authorization ───────────────────────────────────────

describe('burnout.orgSummary — authorization', () => {
  it('throws FORBIDDEN for non-coordinator', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver' }, error: null })
    )
    await expect(authedCaller.burnout.orgSummary({ org_id: ORG_ID }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when membership is null', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { message: 'not found' } })
    )
    await expect(authedCaller.burnout.orgSummary({ org_id: ORG_ID }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns aggregated data for coordinator', async () => {
    const sampleRows = [
      { week_stamp: WEEK_STAMP, sleep_score: 4, stress_score: 2, support_score: 5 },
      { week_stamp: WEEK_STAMP, sleep_score: 2, stress_score: 4, support_score: 3 },
    ]
    let callCount = 0
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeSelectChain({ data: { role: 'coordinator' }, error: null })
      return makeSelectChain({ data: sampleRows, error: null })
    })

    const result = await authedCaller.burnout.orgSummary({ org_id: ORG_ID })
    expect(result).toHaveLength(1)
    expect(result[0].week_stamp).toBe(WEEK_STAMP)
    expect(result[0].count).toBe(2)
    expect(result[0].avg_sleep).toBe(3)
  })
})

// ─── burnout.myHistory — user isolation ──────────────────────────────────────

describe('burnout.myHistory — user isolation', () => {
  it('returns only the current user rows (filtered by ctx.user.id)', async () => {
    const myRows = [
      { id: 'row-1', user_id: USER_ID, org_id: ORG_ID, week_stamp: WEEK_STAMP, sleep_score: 3, stress_score: 3, support_score: 3 },
    ]
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeSelectChain({ data: myRows, error: null }))

    const result = await authedCaller.burnout.myHistory({ org_id: ORG_ID })
    expect(result).toEqual(myRows)
    // Confirm supabaseAdmin.from was called (query executed)
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith('burnout_checkins')
  })
})
