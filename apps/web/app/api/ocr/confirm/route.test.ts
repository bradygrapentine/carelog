import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn(),
}))

import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'

const VALID_UUID    = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const VALID_ORG_ID  = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const VALID_JOB_ID  = 'cccccccc-dddd-eeee-ffff-000000000000'
const VALID_REC_ID  = 'dddddddd-eeee-ffff-0000-111111111111'

const VALID_BODY = {
  jobId:       VALID_JOB_ID,
  orgId:       VALID_ORG_ID,
  recipientId: VALID_REC_ID,
  drug_name:   'Metformin',
  dosage:      '500mg',
}

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.insert = () => chain
  chain.update = () => chain
  chain.eq     = () => chain
  chain.not    = () => chain
  chain.single = vi.fn().mockResolvedValue(result)
  chain.then   = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)
  return chain
}

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/ocr/confirm', {
    method:  'POST',
    body:    JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
  vi.mocked(getRequestUser).mockResolvedValue({ id: VALID_UUID } as any)
})

describe('POST /api/ocr/confirm', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null as any)

    const res = await POST(postRequest(VALID_BODY))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/Unauthorized/)
  })

  it('returns 400 when jobId is not a UUID', async () => {
    const res = await POST(postRequest({ ...VALID_BODY, jobId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid request body/)
  })

  it('returns 403 when caller is not a coordinator', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() =>
      makeSelectChain({ data: { role: 'caregiver' }, error: null }) as any,
    )

    const res = await POST(postRequest(VALID_BODY))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/Forbidden/)
  })

  it('returns 404 when job not found', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => makeSelectChain({ data: { role: 'coordinator' }, error: null }) as any)
      .mockImplementationOnce(() => makeSelectChain({ data: null, error: null }) as any)

    const res = await POST(postRequest(VALID_BODY))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/Job not found/)
  })

  it('returns 200 { ok: true } on success', async () => {
    vi.mocked(supabaseAdmin.from)
      // membership check
      .mockImplementationOnce(() => makeSelectChain({ data: { role: 'coordinator' }, error: null }) as any)
      // job lookup
      .mockImplementationOnce(() => makeSelectChain({ data: { id: VALID_JOB_ID }, error: null }) as any)
      // medication insert
      .mockImplementationOnce(() => makeSelectChain({ data: null, error: null }) as any)
      // ocr_jobs update
      .mockImplementationOnce(() => makeSelectChain({ data: null, error: null }) as any)

    const res = await POST(postRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
