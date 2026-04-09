import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}))

vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn(),
}))

import { POST } from './route'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'

const VALID_UUID      = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const VALID_ORG_ID    = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const VALID_RECIP_ID  = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa'
const BRIEF_ID        = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff'

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select  = () => chain
  chain.insert  = () => chain
  chain.eq      = () => chain
  chain.gte     = () => chain
  chain.order   = () => chain
  chain.limit   = () => chain
  chain.single  = vi.fn().mockResolvedValue(result)
  chain.then    = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)
  return chain
}

function briefRequest(body: unknown) {
  return new NextRequest('http://localhost/api/brief', {
    method:  'POST',
    body:    JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const VALID_BODY = {
  org_id:       VALID_ORG_ID,
  recipient_id: VALID_RECIP_ID,
  title:        'Test Brief',
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
  vi.mocked(getRequestUser).mockResolvedValue({ id: VALID_UUID } as any)
})

describe('POST /api/brief', () => {
  it('returns 401 when user not authenticated', async () => {
    vi.mocked(getRequestUser).mockResolvedValueOnce(null)

    const res = await POST(briefRequest(VALID_BODY))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/Unauthorized/)
  })

  it('returns 400 when org_id is not a UUID', async () => {
    const res = await POST(briefRequest({ org_id: 'not-a-uuid', recipient_id: VALID_RECIP_ID }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when recipient_id is not a UUID', async () => {
    const res = await POST(briefRequest({ org_id: VALID_ORG_ID, recipient_id: 'bad-id' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when caller is not a coordinator', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() =>
      makeSelectChain({ data: { role: 'supporter', accepted_at: '2026-01-01' }, error: null }) as any,
    )

    const res = await POST(briefRequest(VALID_BODY))
    expect(res.status).toBe(403)
  })

  it('returns 403 when membership not found', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() =>
      makeSelectChain({ data: null, error: { message: 'No rows' } }) as any,
    )

    const res = await POST(briefRequest(VALID_BODY))
    expect(res.status).toBe(403)
  })

  it('returns 404 when care_recipient not found', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() =>
        makeSelectChain({ data: { role: 'coordinator', accepted_at: '2026-01-01' }, error: null }) as any,
      )
      .mockImplementationOnce(() =>
        makeSelectChain({ data: null, error: { message: 'Not found' } }) as any,
      )

    const res = await POST(briefRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('returns 200 with { share_token, id } on success', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() =>
        makeSelectChain({ data: { role: 'coordinator', accepted_at: '2026-01-01' }, error: null }) as any,
      )
      .mockImplementationOnce(() =>
        makeSelectChain({ data: { identity_token: 'tok123' }, error: null }) as any,
      )
      .mockImplementationOnce(() =>
        makeSelectChain({ data: { full_name: 'Jane Doe', dob: null }, error: null }) as any,
      )
      .mockImplementationOnce(() =>
        makeSelectChain({ data: [], error: null }) as any,
      )
      .mockImplementationOnce(() =>
        makeSelectChain({ data: [], error: null }) as any,
      )
      .mockImplementationOnce(() =>
        makeSelectChain({ data: { id: BRIEF_ID, share_token: 'abc123' }, error: null }) as any,
      )

    const res = await POST(briefRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ share_token: 'abc123', id: BRIEF_ID })
  })
})
