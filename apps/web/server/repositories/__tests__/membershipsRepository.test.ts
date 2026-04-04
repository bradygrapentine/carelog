import { describe, it, expect, vi, beforeEach } from 'vitest'
import { acceptInvite } from '../membershipsRepository'

vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

import { supabaseAdmin } from '@/server/supabaseAdmin.server'

const INVITE_ID     = '11111111-1111-1111-1111-111111111111'
const MEMBERSHIP_ID = '22222222-2222-2222-2222-222222222222'
const USER_ID       = '33333333-3333-3333-3333-333333333333'
const USER_EMAIL    = 'user@test.com'
const VALID_TOKEN   = 'a'.repeat(64)

function futureDate() {
  return new Date(Date.now() + 86_400_000).toISOString()
}

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq     = () => chain
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {}
  chain.update = () => chain
  chain.eq     = () => chain
  chain.then   = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  return chain
}

function validInvite(overrides: Record<string, unknown> = {}) {
  return {
    id:            INVITE_ID,
    membership_id: MEMBERSHIP_ID,
    email:         USER_EMAIL,
    expires_at:    futureDate(),
    consumed_at:   null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
})

describe('acceptInvite state machine', () => {
  it('throws "Invalid invite token" when no invite is found', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () => makeSelectChain({ data: null, error: { message: 'not found' } }) as any,
    )

    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: USER_EMAIL }),
    ).rejects.toThrow('Invalid invite token')
  })

  it('throws when the token has already been consumed', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () => makeSelectChain({
        data: validInvite({ consumed_at: new Date().toISOString() }),
        error: null,
      }) as any,
    )

    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: USER_EMAIL }),
    ).rejects.toThrow('This invite has already been used')
  })

  it('throws when the token has expired', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () => makeSelectChain({
        data: validInvite({ expires_at: pastDate }),
        error: null,
      }) as any,
    )

    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: USER_EMAIL }),
    ).rejects.toThrow('This invite has expired')
  })

  it('throws when the accepting user email does not match', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () => makeSelectChain({
        data: validInvite({ email: 'other@test.com' }),
        error: null,
      }) as any,
    )

    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: USER_EMAIL }),
    ).rejects.toThrow('This invite was sent to a different email address')
  })

  it('accepts when invite email has different casing than accepting user', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () => makeSelectChain({
          data: validInvite({ email: 'user@test.com' }),
          error: null,
        }) as any,
      )
      .mockImplementation(() => makeUpdateChain() as any)

    // Accepting with uppercase — repository lowercases the incoming email
    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: 'USER@TEST.COM' }),
    ).resolves.toBeUndefined()
  })

  it('resolves and fires both updates on the happy path', async () => {
    const updateChain = makeUpdateChain()
    const updateSpy   = vi.fn(() => updateChain)

    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () => makeSelectChain({ data: validInvite(), error: null }) as any,
      )
      .mockImplementation(updateSpy as any)

    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: USER_EMAIL }),
    ).resolves.toBeUndefined()

    // Promise.all fires two from() calls — one for each update
    expect(updateSpy).toHaveBeenCalledTimes(2)
  })
})
