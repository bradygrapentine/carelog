import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}))

import { POST } from './route'
import { supabaseAdmin } from '@/server/supabaseAdmin.server'

const TOKEN = 'test-share-token-abc'

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq     = () => chain
  chain.single = vi.fn().mockResolvedValue(result)
  chain.then   = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)
  return chain
}

function claimRequest(shareToken: string, body: unknown) {
  return new NextRequest('http://localhost/api/outer-circle/' + shareToken + '/claim', {
    method:  'POST',
    body:    JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
  vi.mocked(supabaseAdmin.rpc).mockReset()
})

describe('POST /api/outer-circle/[shareToken]/claim', () => {
  it('returns 400 when name is missing', async () => {
    const res = await POST(
      claimRequest(TOKEN, { email: 'test@example.com' }),
      { params: Promise.resolve({ shareToken: TOKEN }) },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required/)
  })

  it('returns 400 when email is missing', async () => {
    const res = await POST(
      claimRequest(TOKEN, { name: 'Jane Doe' }),
      { params: Promise.resolve({ shareToken: TOKEN }) },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required/)
  })

  it('returns 404 when share_token not found', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() =>
      makeSelectChain({ data: null, error: { message: 'Not found' } }) as any,
    )

    const res = await POST(
      claimRequest(TOKEN, { name: 'Jane Doe', email: 'jane@example.com' }),
      { params: Promise.resolve({ shareToken: TOKEN }) },
    )
    expect(res.status).toBe(404)
  })

  it('returns 410 when request is inactive', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() =>
      makeSelectChain({ data: { id: 'req-id-123', active: false }, error: null }) as any,
    )

    const res = await POST(
      claimRequest(TOKEN, { name: 'Jane Doe', email: 'jane@example.com' }),
      { params: Promise.resolve({ shareToken: TOKEN }) },
    )
    expect(res.status).toBe(410)
  })

  it('returns 409 when rpc returns slot_unavailable error', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() =>
      makeSelectChain({ data: { id: 'req-id-123', active: true }, error: null }) as any,
    )
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'slot_unavailable: no open slots' },
    } as any)

    const res = await POST(
      claimRequest(TOKEN, { name: 'Jane Doe', email: 'jane@example.com' }),
      { params: Promise.resolve({ shareToken: TOKEN }) },
    )
    expect(res.status).toBe(409)
  })

  it('returns 200 { claimed: true } on success', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() =>
      makeSelectChain({ data: { id: 'req-id-123', active: true }, error: null }) as any,
    )
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({
      data: null,
      error: null,
    } as any)

    const res = await POST(
      claimRequest(TOKEN, { name: 'Jane Doe', email: 'jane@example.com', slot_date: '2026-05-01' }),
      { params: Promise.resolve({ shareToken: TOKEN }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ claimed: true })
  })
})
