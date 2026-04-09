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
const SHIFT_ID = '38dc6d19-6712-4b26-8797-b4e544e01b86'
const REC_ID   = '48dc6d19-6712-4b26-8797-b4e544e01b87'

const PAST   = '2026-04-08T08:00:00.000Z'
const FUTURE = '2026-04-08T16:00:00.000Z'

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

function makeSelectChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain }
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
})

// ─── shifts.cancel — authorization ───────────────────────────────────────────

describe('shifts.cancel — authorization', () => {
  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.shifts.cancel({ id: SHIFT_ID, org_id: ORG_ID }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN when caller has no membership', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { message: 'not found' } })
    )
    await expect(authedCaller.shifts.cancel({ id: SHIFT_ID, org_id: ORG_ID }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when caller is caregiver', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(authedCaller.shifts.cancel({ id: SHIFT_ID, org_id: ORG_ID }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when caller is supporter', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'supporter', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(authedCaller.shifts.cancel({ id: SHIFT_ID, org_id: ORG_ID }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when coordinator invite not yet accepted', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'coordinator', accepted_at: null }, error: null })
    )
    await expect(authedCaller.shifts.cancel({ id: SHIFT_ID, org_id: ORG_ID }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── shifts.create — authorization ───────────────────────────────────────────

describe('shifts.create — authorization', () => {
  const createBase = {
    org_id:           ORG_ID,
    recipient_id:     REC_ID,
    assignee_user_id: USER_ID,
    start_at:         PAST,
    end_at:           FUTURE,
  }

  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.shifts.create(createBase))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN when caller is not a coordinator', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(authedCaller.shifts.create(createBase))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── shifts.update — authorization ───────────────────────────────────────────

describe('shifts.update — authorization', () => {
  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.shifts.update({ id: SHIFT_ID, org_id: ORG_ID, status: 'completed' }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN when caller is supporter', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'supporter', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(authedCaller.shifts.update({ id: SHIFT_ID, org_id: ORG_ID, status: 'completed' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
