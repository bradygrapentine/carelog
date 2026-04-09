import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))
vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn(),
}))

import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'
import { POST } from './route'

const USER_ID  = '11111111-0000-0000-0000-000000000001'
const OTHER_ID = '22222222-0000-0000-0000-000000000002'
const ORG_ID   = '33333333-0000-0000-0000-000000000003'
const BRIEF_ID = '44444444-0000-0000-0000-000000000004'
const TOKEN    = 'abc123token'

function revokeRequest(shareToken: string) {
  return new NextRequest('http://localhost/api/brief/' + shareToken + '/revoke', {
    method: 'POST',
  })
}

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.update = () => chain
  chain.eq     = () => chain
  chain.single = vi.fn().mockResolvedValue(result)
  chain.then   = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

function makeUpdateChain(error: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.update = () => chain
  chain.eq     = () => chain
  chain.then   = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error }).then(resolve)
  return chain
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
  vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any)
})

describe('POST /api/brief/[shareToken]/revoke', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null)
    const res = await POST(revokeRequest(TOKEN), { params: Promise.resolve({ shareToken: TOKEN }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 when brief not found', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: null }) as any
    )
    const res = await POST(revokeRequest(TOKEN), { params: Promise.resolve({ shareToken: TOKEN }) })
    expect(res.status).toBe(404)
  })

  it('returns 200 when caller is the brief creator', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(makeSelectChain({ data: { id: BRIEF_ID, org_id: ORG_ID, created_by: USER_ID }, error: null }) as any)
      .mockReturnValueOnce(makeUpdateChain() as any)
    const res = await POST(revokeRequest(TOKEN), { params: Promise.resolve({ shareToken: TOKEN }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ revoked: true })
  })

  it('returns 200 when caller is a coordinator (not the creator)', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(makeSelectChain({ data: { id: BRIEF_ID, org_id: ORG_ID, created_by: OTHER_ID }, error: null }) as any)
      .mockReturnValueOnce(makeSelectChain({ data: { role: 'coordinator', accepted_at: '2026-01-01' }, error: null }) as any)
      .mockReturnValueOnce(makeUpdateChain() as any)
    const res = await POST(revokeRequest(TOKEN), { params: Promise.resolve({ shareToken: TOKEN }) })
    expect(res.status).toBe(200)
  })

  it('returns 403 when caller is neither creator nor coordinator', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(makeSelectChain({ data: { id: BRIEF_ID, org_id: ORG_ID, created_by: OTHER_ID }, error: null }) as any)
      .mockReturnValueOnce(makeSelectChain({ data: { role: 'caregiver', accepted_at: '2026-01-01' }, error: null }) as any)
    const res = await POST(revokeRequest(TOKEN), { params: Promise.resolve({ shareToken: TOKEN }) })
    expect(res.status).toBe(403)
  })

  it('returns 500 when DB update fails', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(makeSelectChain({ data: { id: BRIEF_ID, org_id: ORG_ID, created_by: USER_ID }, error: null }) as any)
      .mockReturnValueOnce(makeUpdateChain({ message: 'DB error' }) as any)
    const res = await POST(revokeRequest(TOKEN), { params: Promise.resolve({ shareToken: TOKEN }) })
    expect(res.status).toBe(500)
  })
})
