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

const ORG_ID   = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const USER_ID  = '28dc6d19-6712-4b26-8797-b4e544e01b85'
const REC_ID   = '48dc6d19-6712-4b26-8797-b4e544e01b87'

const authedCaller = appRouter.createCaller({
  user:     { id: USER_ID, email: 'user@example.com' } as any,
  supabase: { from: vi.fn() } as any,
  req:      undefined,
})

// Helper: build a select chain that ends in .single()
function makeSelectChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain, not: () => chain, order: () => chain, limit: () => chain }
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

// Helper: build a chain for list queries (no .single())
function makeListChain(result: object) {
  const chain: any = {
    select:  () => chain,
    eq:      () => chain,
    not:     () => chain,
    order:   () => chain,
    limit:   vi.fn().mockResolvedValue(result),
  }
  return chain
}

// Helper: build a chain for insert mutations
function makeInsertChain(result: object) {
  const chain: any = {
    insert: vi.fn().mockResolvedValue(result),
  }
  return chain
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
})

// ─── symptoms.list ────────────────────────────────────────────────────────────

describe('symptoms.list — any org member can read', () => {
  it('returns data for any authenticated org member', async () => {
    const sampleData = [
      { id: 'reading-1', pain_level: 4, mood: 'okay', recorded_at: '2026-04-09T00:00:00Z' },
    ]
    let callCount = 0
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeSelectChain({ data: { role: 'caregiver' }, error: null })
      return makeListChain({ data: sampleData, error: null })
    })

    const result = await authedCaller.symptoms.list({ org_id: ORG_ID, recipient_id: REC_ID })
    expect(result).toEqual(sampleData)
  })

  it('throws FORBIDDEN when caller is not an org member', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: null })
    )

    const OTHER_ORG = '99dc6d19-6712-4b26-8797-b4e544e01b99'
    await expect(authedCaller.symptoms.list({ org_id: OTHER_ORG, recipient_id: REC_ID }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── symptoms.log — authorization ─────────────────────────────────────────────

describe('symptoms.log — authorization', () => {
  const logBase = {
    org_id:       ORG_ID,
    recipient_id: REC_ID,
    pain_level:   5,
    mood:         'okay' as const,
  }

  it('throws FORBIDDEN when role is supporter', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'supporter' }, error: null })
    )
    await expect(authedCaller.symptoms.log(logBase))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('succeeds when role is coordinator', async () => {
    let callCount = 0
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeSelectChain({ data: { role: 'coordinator' }, error: null })
      // second call is the insert
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as any
    })
    const result = await authedCaller.symptoms.log(logBase)
    expect(result).toEqual({ ok: true })
  })

  it('succeeds when role is caregiver', async () => {
    let callCount = 0
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeSelectChain({ data: { role: 'caregiver' }, error: null })
      return { insert: vi.fn().mockResolvedValue({ error: null }) } as any
    })
    const result = await authedCaller.symptoms.log(logBase)
    expect(result).toEqual({ ok: true })
  })
})
