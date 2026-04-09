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

const ORG_ID  = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const REC_ID  = '28dc6d19-6712-4b26-8797-b4e544e01b85'
const REQ_ID  = '38dc6d19-6712-4b26-8797-b4e544e01b86'
const USER_ID = '48dc6d19-6712-4b26-8797-b4e544e01b87'

function makeSelectChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain, order: () => chain }
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

// ctx.supabase mock that resolves list queries successfully
function makeSupabaseCtx() {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  return { from: vi.fn().mockReturnValue(chain) }
}

const authedCaller = appRouter.createCaller({
  user:     { id: USER_ID, email: 'user@example.com' } as any,
  supabase: makeSupabaseCtx() as any,
  req:      undefined,
})

const anonCaller = appRouter.createCaller({
  user:     null,
  supabase: {} as any,
  req:      undefined,
})

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
})

// ─── outerCircle.create — authorization ──────────────────────────────────────

describe('outerCircle.create — authorization', () => {
  const createInput = {
    org_id:       ORG_ID,
    recipient_id: REC_ID,
    title:        'Meals needed',
    request_type: 'meal' as const,
    slots_total:  3,
  }

  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.outerCircle.create(createInput))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN when caller is caregiver', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(authedCaller.outerCircle.create(createInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when coordinator invite not yet accepted', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'coordinator', accepted_at: null }, error: null })
    )
    await expect(authedCaller.outerCircle.create(createInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── outerCircle.deactivate — authorization ──────────────────────────────────

describe('outerCircle.deactivate — authorization', () => {
  const deactivateInput = { id: REQ_ID, org_id: ORG_ID }

  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.outerCircle.deactivate(deactivateInput))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN when caller is caregiver', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(authedCaller.outerCircle.deactivate(deactivateInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── outerCircle.list — authorization ────────────────────────────────────────

describe('outerCircle.list — authorization', () => {
  const listInput = { org_id: ORG_ID, recipient_id: REC_ID }

  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.outerCircle.list(listInput))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('returns data for authenticated user', async () => {
    const result = await authedCaller.outerCircle.list(listInput)
    expect(Array.isArray(result)).toBe(true)
  })
})
