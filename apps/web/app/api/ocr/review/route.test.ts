import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn(),
}))

import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'

const VALID_UUID   = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const VALID_ORG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq     = () => chain
  chain.not    = () => chain
  chain.order  = vi.fn().mockResolvedValue(result)
  chain.single = vi.fn().mockResolvedValue(result)
  chain.then   = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)
  return chain
}

function reviewRequest(orgId?: string) {
  const url = 'http://localhost/api/ocr/review' + (orgId ? '?orgId=' + orgId : '')
  return new NextRequest(url, { method: 'GET' })
}

const mockJobs = [
  { id: VALID_UUID, recipient_id: VALID_UUID, image_url: 'http://example.com/img.jpg', raw_text: 'text', parsed_payload: {}, created_at: new Date().toISOString() },
]

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
  vi.mocked(getRequestUser).mockResolvedValue({ id: VALID_UUID } as any)
})

describe('GET /api/ocr/review', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null as any)

    const res = await GET(reviewRequest(VALID_ORG_ID))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/Unauthorized/)
  })

  it('returns 400 when orgId missing from query', async () => {
    const res = await GET(reviewRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid orgId/)
  })

  it('returns 403 when caller is not a coordinator', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() =>
      makeSelectChain({ data: { role: 'caregiver' }, error: null }) as any,
    )

    const res = await GET(reviewRequest(VALID_ORG_ID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/Forbidden/)
  })

  it('returns 200 with empty array when no pending reviews', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => makeSelectChain({ data: { role: 'coordinator' }, error: null }) as any)
      .mockImplementationOnce(() => makeSelectChain({ data: [], error: null }) as any)

    const res = await GET(reviewRequest(VALID_ORG_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobs).toEqual([])
  })

  it('returns 200 with jobs array on success', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => makeSelectChain({ data: { role: 'coordinator' }, error: null }) as any)
      .mockImplementationOnce(() => makeSelectChain({ data: mockJobs, error: null }) as any)

    const res = await GET(reviewRequest(VALID_ORG_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobs).toHaveLength(1)
    expect(body.jobs[0].id).toBe(VALID_UUID)
  })
})
