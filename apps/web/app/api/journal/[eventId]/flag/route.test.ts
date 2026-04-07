import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from './route'

vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn(),
}))

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}))

import { supabaseAdmin } from '@/server/supabaseAdmin.server'
import { getRequestUser } from '@/lib/supabaseServer'

const VALID_UUID   = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const VALID_ORG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const VALID_BODY   = { flagged: true, userId: VALID_UUID }

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.update = () => chain
  chain.eq     = () => chain
  chain.not    = () => chain
  chain.single = vi.fn().mockResolvedValue(result)
  chain.then   = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)
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

function patchRequest(eventId: string, body: unknown) {
  return new NextRequest(`http://localhost/api/journal/${eventId}/flag`, {
    method:  'PATCH',
    body:    JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const mockEvent = {
  recipient_id:    VALID_UUID,
  care_recipients: { org_id: VALID_ORG_ID },
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset()
  vi.mocked(getRequestUser).mockResolvedValue({ id: VALID_UUID } as any)
})

describe('PATCH /api/journal/[eventId]/flag', () => {
  it('returns 400 for an invalid eventId', async () => {
    const res = await PATCH(
      patchRequest('not-a-uuid', VALID_BODY),
      { params: Promise.resolve({ eventId: 'not-a-uuid' }) },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid eventId/)
  })

  it('returns 400 when flagged field is missing', async () => {
    const res = await PATCH(
      patchRequest(VALID_UUID, { userId: VALID_UUID }),
      { params: Promise.resolve({ eventId: VALID_UUID }) },
    )
    expect(res.status).toBe(400)
  })


  it('returns 404 when the event does not exist', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() =>
      makeSelectChain({ data: null, error: null }) as any,
    )

    const res = await PATCH(
      patchRequest(VALID_UUID, VALID_BODY),
      { params: Promise.resolve({ eventId: VALID_UUID }) },
    )
    expect(res.status).toBe(404)
  })

  it('returns 403 when caller has no membership', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => makeSelectChain({ data: mockEvent, error: null }) as any)
      .mockImplementationOnce(() => makeSelectChain({ data: null, error: null }) as any)

    const res = await PATCH(
      patchRequest(VALID_UUID, VALID_BODY),
      { params: Promise.resolve({ eventId: VALID_UUID }) },
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/Not authorized/)
  })

  it('returns 403 when caller is a supporter', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => makeSelectChain({ data: mockEvent, error: null }) as any)
      .mockImplementationOnce(() => makeSelectChain({ data: { role: 'supporter' }, error: null }) as any)

    const res = await PATCH(
      patchRequest(VALID_UUID, VALID_BODY),
      { params: Promise.resolve({ eventId: VALID_UUID }) },
    )
    expect(res.status).toBe(403)
  })

  it('returns 200 and flags the entry for a caregiver', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => makeSelectChain({ data: mockEvent, error: null }) as any)
      .mockImplementationOnce(() => makeSelectChain({ data: { role: 'caregiver' }, error: null }) as any)
      .mockImplementationOnce(() => makeUpdateChain() as any)

    const res = await PATCH(
      patchRequest(VALID_UUID, { flagged: true, userId: VALID_UUID }),
      { params: Promise.resolve({ eventId: VALID_UUID }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, flagged: true })
  })

  it('returns 200 and unflagged for a coordinator', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => makeSelectChain({ data: mockEvent, error: null }) as any)
      .mockImplementationOnce(() => makeSelectChain({ data: { role: 'coordinator' }, error: null }) as any)
      .mockImplementationOnce(() => makeUpdateChain() as any)

    const res = await PATCH(
      patchRequest(VALID_UUID, { flagged: false, userId: VALID_UUID }),
      { params: Promise.resolve({ eventId: VALID_UUID }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, flagged: false })
  })

  it('returns 200 for an aide', async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(() => makeSelectChain({ data: mockEvent, error: null }) as any)
      .mockImplementationOnce(() => makeSelectChain({ data: { role: 'aide' }, error: null }) as any)
      .mockImplementationOnce(() => makeUpdateChain() as any)

    const res = await PATCH(
      patchRequest(VALID_UUID, VALID_BODY),
      { params: Promise.resolve({ eventId: VALID_UUID }) },
    )
    expect(res.status).toBe(200)
  })
})
