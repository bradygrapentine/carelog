import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}))
vi.mock('@/server/repositories/membershipsRepository', () => ({
  getMemberships: vi.fn(),
  createMembershipAndInvite: vi.fn().mockResolvedValue({
    membershipId: '11111111-1111-1111-1111-111111111111',
    token: 'a'.repeat(64),
  }),
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

const ORG_ID     = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const USER_ID    = '28dc6d19-6712-4b26-8797-b4e544e01b85'
const VALID_TOKEN = 'a'.repeat(64)

const caller = appRouter.createCaller({
  user:     { id: USER_ID, email: 'user@example.com' } as any,
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
  vi.mocked(supabaseAdmin.rpc).mockReset()
})

// ─── memberships.invite — coordinator authorization ───────────────────────────

const inviteBase = {
  orgId: ORG_ID, recipientId: ORG_ID, role: 'caregiver' as const, email: 'new@example.com',
}

describe('memberships.invite — coordinator authorization', () => {
  it('throws FORBIDDEN when caller has no membership in org', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { message: 'not found' } })
    )
    await expect(caller.memberships.invite(inviteBase)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when caller role is caregiver', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(caller.memberships.invite(inviteBase)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when caller role is supporter', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'supporter', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(caller.memberships.invite(inviteBase)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when caller is coordinator but invite not yet accepted', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'coordinator', accepted_at: null }, error: null })
    )
    await expect(caller.memberships.invite(inviteBase)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('succeeds and returns inviteUrl when caller is accepted coordinator', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'coordinator', accepted_at: new Date().toISOString() }, error: null })
    )
    const result = await caller.memberships.invite(inviteBase)
    expect(result).toHaveProperty('inviteUrl')
    expect(result).toHaveProperty('membershipId')
  })
})

// ─── memberships.accept — atomic RPC error mapping ───────────────────────────

describe('memberships.accept — RPC error mapping', () => {
  it('throws FORBIDDEN when RPC returns not_found', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue(
      { data: { success: false, error: 'not_found' }, error: null } as any
    )
    await expect(caller.memberships.accept({ token: VALID_TOKEN }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when RPC returns email_mismatch', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue(
      { data: { success: false, error: 'email_mismatch' }, error: null } as any
    )
    await expect(caller.memberships.accept({ token: VALID_TOKEN }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws CONFLICT when RPC returns already_used', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue(
      { data: { success: false, error: 'already_used' }, error: null } as any
    )
    await expect(caller.memberships.accept({ token: VALID_TOKEN }))
      .rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('throws INTERNAL_SERVER_ERROR on Supabase transport error', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue(
      { data: null, error: { message: 'connection refused' } } as any
    )
    await expect(caller.memberships.accept({ token: VALID_TOKEN }))
      .rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
  })

  it('returns { success: true } on happy path', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue(
      { data: { success: true, error: null }, error: null } as any
    )
    const result = await caller.memberships.accept({ token: VALID_TOKEN })
    expect(result).toEqual({ success: true })
  })

  it('calls accept_invite RPC with correct params', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue(
      { data: { success: true, error: null }, error: null } as any
    )
    await caller.memberships.accept({ token: VALID_TOKEN })
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('accept_invite', {
      p_token:   VALID_TOKEN,
      p_user_id: USER_ID,
      p_email:   'user@example.com',
    })
  })
})
