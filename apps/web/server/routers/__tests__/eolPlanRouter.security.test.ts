import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}))
vi.mock('@/server/repositories/membershipsRepository', () => ({
  getMemberships: vi.fn(), createMembershipAndInvite: vi.fn(),
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
const OTHER_ID = '99dc6d19-6712-4b26-8797-b4e544e01b99'

const authedCaller = appRouter.createCaller({
  user:     { id: USER_ID, email: 'user@example.com' } as any,
  supabase: { from: vi.fn() } as any,
  req:      undefined,
})

const anonCaller = appRouter.createCaller({
  user:     null,
  supabase: {} as any,
  req:      undefined,
})

// Helper: select chain whose .single() resolves to result
function makeSelectChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain, not: () => chain }
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

// Helper: upsert chain
function makeUpsertChain(result: object) {
  return { upsert: vi.fn().mockResolvedValue(result) } as any
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
})

// Base upsert payload
const upsertBase = {
  org_id:           ORG_ID,
  recipient_id:     REC_ID,
  healthcare_proxy: 'Jane Doe',
  resuscitation_pref: 'dnr' as const,
  funeral_pref:     'Cremation',
  legacy_message:   'Thank you.',
  attorney_name:    'John Smith',
  attorney_contact: '555-1234',
}

// ─── eolPlan.get ──────────────────────────────────────────────────────────────

describe('eolPlan.get — authentication', () => {
  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.eolPlan.get({ org_id: ORG_ID, recipient_id: REC_ID }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('eolPlan.get — coordinator-only access', () => {
  it('throws FORBIDDEN when role is caregiver', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver' }, error: null }),
    )

    await expect(authedCaller.eolPlan.get({ org_id: ORG_ID, recipient_id: REC_ID }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when role is supporter', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'supporter' }, error: null }),
    )

    await expect(authedCaller.eolPlan.get({ org_id: ORG_ID, recipient_id: REC_ID }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when caller is not an org member', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: null }),
    )

    await expect(authedCaller.eolPlan.get({ org_id: OTHER_ID, recipient_id: REC_ID }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns null when coordinator but no plan exists (PGRST116)', async () => {
    let callCount = 0
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeSelectChain({ data: { role: 'coordinator' }, error: null })
      // eol_plans select returns PGRST116 (no rows)
      return makeSelectChain({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    })

    const result = await authedCaller.eolPlan.get({ org_id: ORG_ID, recipient_id: REC_ID })
    expect(result).toBeNull()
  })

  it('returns plan data when coordinator and plan exists', async () => {
    const plan = { id: 'plan-1', org_id: ORG_ID, recipient_id: REC_ID, resuscitation_pref: 'dnr' }
    let callCount = 0
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeSelectChain({ data: { role: 'coordinator' }, error: null })
      return makeSelectChain({ data: plan, error: null })
    })

    const result = await authedCaller.eolPlan.get({ org_id: ORG_ID, recipient_id: REC_ID })
    expect(result).toEqual(plan)
  })
})

// ─── eolPlan.upsert ───────────────────────────────────────────────────────────

describe('eolPlan.upsert — authentication', () => {
  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.eolPlan.upsert(upsertBase))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('eolPlan.upsert — coordinator-only access', () => {
  it('throws FORBIDDEN when role is caregiver', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver' }, error: null }),
    )

    await expect(authedCaller.eolPlan.upsert(upsertBase))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when role is supporter', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'supporter' }, error: null }),
    )

    await expect(authedCaller.eolPlan.upsert(upsertBase))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('eolPlan.upsert — IDOR prevention', () => {
  it('throws FORBIDDEN when recipient_id does not belong to org_id', async () => {
    // Coordinator passes membership check but recipient is in a different org
    let callCount = 0
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeSelectChain({ data: { role: 'coordinator' }, error: null })
      // care_recipients query: recipient not found in this org
      return makeSelectChain({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    })

    const maliciousInput = { ...upsertBase, recipient_id: OTHER_ID }
    await expect(authedCaller.eolPlan.upsert(maliciousInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('succeeds when coordinator and recipient belongs to org', async () => {
    let callCount = 0
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeSelectChain({ data: { role: 'coordinator' }, error: null })
      if (callCount === 2) return makeSelectChain({ data: { id: REC_ID }, error: null })
      return makeUpsertChain({ error: null })
    })

    const result = await authedCaller.eolPlan.upsert(upsertBase)
    expect(result).toEqual({ ok: true })
  })
})
