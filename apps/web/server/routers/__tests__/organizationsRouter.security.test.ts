// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

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
  getOrganization: vi.fn(),
  createOrganization: vi.fn(),
  getUserOrganizations: vi.fn(),
}))
vi.mock('@/server/repositories/identityRepository', () => ({
  createIdentity: vi.fn(),
}))

import { getUserOrganizations, getOrganization } from '@/server/repositories/organizationsRepository'
import { appRouter } from '@/server/trpc/router'

const ORG_ID  = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const USER_ID = '28dc6d19-6712-4b26-8797-b4e544e01b85'

const authedCaller = appRouter.createCaller({
  user:     { id: USER_ID, email: 'user@example.com' } as any,
  supabase: {} as any,
  req:      undefined,
})

const anonCaller = appRouter.createCaller({
  user:     null,
  supabase: {} as any,
  req:      undefined,
})

// ─── organizations.list — authentication ──────────────────────────────────────

describe('organizations.list — authentication', () => {
  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.organizations.list())
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('returns only orgs the user belongs to (delegates to repository)', async () => {
    const fakeOrg = { id: ORG_ID, name: 'Test Family' }
    vi.mocked(getUserOrganizations).mockResolvedValue([fakeOrg] as any)

    const result = await authedCaller.organizations.list()
    expect(result).toEqual([fakeOrg])
    expect(getUserOrganizations).toHaveBeenCalledWith(expect.anything(), USER_ID)
  })
})

// ─── organizations.get — authentication ──────────────────────────────────────

describe('organizations.get — authentication', () => {
  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.organizations.get({ orgId: ORG_ID }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('returns org when found (delegates to repository)', async () => {
    const fakeOrg = { id: ORG_ID, name: 'Test Family' }
    vi.mocked(getOrganization).mockResolvedValue(fakeOrg as any)

    const result = await authedCaller.organizations.get({ orgId: ORG_ID })
    expect(result).toEqual(fakeOrg)
  })
})
