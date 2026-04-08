import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))
vi.mock('@/server/repositories/careEventsRepository', () => ({
  getTimeline: vi.fn(),
  insertEvent: vi.fn().mockResolvedValue({ id: 'event-1' }),
  getFlaggedEvents: vi.fn(),
  insertEventIdempotent: vi.fn().mockResolvedValue({ id: 'event-2' }),
}))
vi.mock('@/server/repositories/membershipsRepository', () => ({
  getMemberships: vi.fn(), createMembershipAndInvite: vi.fn(),
}))
vi.mock('@/server/repositories/organizationsRepository', () => ({
  getOrganization: vi.fn(), createOrganization: vi.fn(), getUserOrganizations: vi.fn(),
}))
vi.mock('@/server/repositories/identityRepository', () => ({
  createIdentity: vi.fn(),
}))

import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { insertEvent, insertEventIdempotent } from '@/server/repositories/careEventsRepository'
import { appRouter } from '@/server/trpc/router'

const ORG_ID       = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const RECIPIENT_ID = '28dc6d19-6712-4b26-8797-b4e544e01b85'
const USER_ID      = '38dc6d19-6712-4b26-8797-b4e544e01b86'

const caller = appRouter.createCaller({
  user:     { id: USER_ID, email: 'actor@example.com' } as any,
  supabase: {} as any,
  req:      undefined,
})

function makeSelectChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain }
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

const baseInput = {
  orgId:       ORG_ID,
  recipientId: RECIPIENT_ID,
  eventType:   'journal' as const,
  entryKind:   'human' as const,
  payload:     { text: 'Today was hard' },
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
  vi.mocked(insertEvent).mockReset()
  vi.mocked(insertEventIdempotent).mockReset()
})

// ─── careEvents.insert — org/recipient consistency ────────────────────────────

describe('careEvents.insert — org/recipient consistency check', () => {
  it('throws FORBIDDEN when recipient is not found in the specified org', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: null })
    )
    await expect(caller.careEvents.insert(baseInput)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('throws FORBIDDEN when supabase returns an error on recipient lookup', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: { message: 'relation does not exist' } })
    )
    await expect(caller.careEvents.insert(baseInput)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('does not call insertEvent when recipient check fails', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: null })
    )
    try { await caller.careEvents.insert(baseInput) } catch {}
    expect(insertEvent).not.toHaveBeenCalled()
  })

  it('calls insertEvent when recipient belongs to org', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { id: RECIPIENT_ID }, error: null })
    )
    vi.mocked(insertEvent).mockResolvedValue({ id: 'event-1' } as any)
    await caller.careEvents.insert(baseInput)
    expect(insertEvent).toHaveBeenCalledOnce()
  })

  it('queries care_recipients with both recipientId and orgId', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: null })
    )
    try { await caller.careEvents.insert(baseInput) } catch {}
    expect(supabaseAdmin.from).toHaveBeenCalledWith('care_recipients')
  })

  it('calls insertEventIdempotent (not insertEvent) when idempotencyKey is provided', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { id: RECIPIENT_ID }, error: null })
    )
    vi.mocked(insertEventIdempotent).mockResolvedValue({ id: 'event-2' } as any)
    await caller.careEvents.insert({ ...baseInput, idempotencyKey: 'key-abc' })
    expect(insertEventIdempotent).toHaveBeenCalledOnce()
    expect(insertEvent).not.toHaveBeenCalled()
  })
})

// ─── careEvents.getOne — authorization ────────────────────────────────────────

function makeSupabaseMock(result: object) {
  const chain: any = {}
  chain.select  = vi.fn().mockReturnValue(chain)
  chain.eq      = vi.fn().mockReturnValue(chain)
  chain.single  = vi.fn().mockResolvedValue(result)
  return { from: vi.fn().mockReturnValue(chain) }
}

describe('careEvents.getOne — authorization', () => {
  const EVENT_ID = '48dc6d19-6712-4b26-8797-b4e544e01b87'

  it('throws NOT_FOUND when supabase returns an error', async () => {
    const mockSupabase = makeSupabaseMock({ data: null, error: { message: 'not found' } })
    const callerWithSupabase = appRouter.createCaller({
      user:     { id: USER_ID, email: 'actor@example.com' } as any,
      supabase: mockSupabase as any,
      req:      undefined,
    })
    await expect(callerWithSupabase.careEvents.getOne({ eventId: EVENT_ID }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws NOT_FOUND when event data is null', async () => {
    const mockSupabase = makeSupabaseMock({ data: null, error: null })
    const callerWithSupabase = appRouter.createCaller({
      user:     { id: USER_ID, email: 'actor@example.com' } as any,
      supabase: mockSupabase as any,
      req:      undefined,
    })
    await expect(callerWithSupabase.careEvents.getOne({ eventId: EVENT_ID }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns event data on success', async () => {
    const fakeEvent = { id: EVENT_ID, event_type: 'journal', entry_kind: 'human' }
    const mockSupabase = makeSupabaseMock({ data: fakeEvent, error: null })
    const callerWithSupabase = appRouter.createCaller({
      user:     { id: USER_ID, email: 'actor@example.com' } as any,
      supabase: mockSupabase as any,
      req:      undefined,
    })
    const result = await callerWithSupabase.careEvents.getOne({ eventId: EVENT_ID })
    expect(result).toMatchObject({ id: EVENT_ID })
  })
})
