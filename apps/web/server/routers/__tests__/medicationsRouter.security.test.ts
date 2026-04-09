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
const MED_ID  = '38dc6d19-6712-4b26-8797-b4e544e01b86'
const USER_ID = '48dc6d19-6712-4b26-8797-b4e544e01b87'

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

// ─── medications.create — authorization ──────────────────────────────────────

describe('medications.create — authorization', () => {
  const createInput = {
    org_id:       ORG_ID,
    recipient_id: REC_ID,
    drug_name:    'Lisinopril',
    dosage:       '10mg',
  }

  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.medications.create(createInput))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN when caller is caregiver', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(authedCaller.medications.create(createInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when coordinator invite not yet accepted', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'coordinator', accepted_at: null }, error: null })
    )
    await expect(authedCaller.medications.create(createInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── medications.update — authorization ──────────────────────────────────────

describe('medications.update — authorization', () => {
  const updateInput = {
    id:                    MED_ID,
    org_id:                ORG_ID,
    supply_days_remaining: 14,
  }

  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.medications.update(updateInput))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN when caller is caregiver', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(authedCaller.medications.update(updateInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when coordinator invite not yet accepted', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'coordinator', accepted_at: null }, error: null })
    )
    await expect(authedCaller.medications.update(updateInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── medications.delete — authorization ──────────────────────────────────────

describe('medications.delete — authorization', () => {
  const deleteInput = { id: MED_ID, org_id: ORG_ID }

  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.medications.delete(deleteInput))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN when caller is caregiver', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(authedCaller.medications.delete(deleteInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when coordinator invite not yet accepted', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'coordinator', accepted_at: null }, error: null })
    )
    await expect(authedCaller.medications.delete(deleteInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

// ─── medications.logAdministration — authorization ───────────────────────────

describe('medications.logAdministration — authorization', () => {
  const logInput = {
    org_id:         ORG_ID,
    recipient_id:   REC_ID,
    medication_id:  MED_ID,
    scheduled_time: '08:00:00',
    action:         'given' as const,
  }

  it('throws UNAUTHORIZED when no user in context', async () => {
    await expect(anonCaller.medications.logAdministration(logInput))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN when caller has supporter role', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: 'supporter', accepted_at: new Date().toISOString() }, error: null })
    )
    await expect(authedCaller.medications.logAdministration(logInput))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
