import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn(),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}))

import { getRequestUser } from '@/lib/supabaseServer'
import { supabaseAdmin }   from '@/server/supabaseAdmin.server'
import { POST }            from './route'

const ORG_ID  = '10000000-0000-0000-0000-000000000001'
const REC_ID  = '20000000-0000-0000-0000-000000000002'
const USER_ID = '30000000-0000-0000-0000-000000000003'

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/export', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

// Helper: build a supabaseAdmin.from chain with .single() returning result
function makeChain(result: object) {
  const chain: Record<string, unknown> & { single: ReturnType<typeof vi.fn>; limit: ReturnType<typeof vi.fn> } = {
    select:  () => chain,
    eq:      () => chain,
    not:     () => chain,
    gte:     () => chain,
    order:   () => chain,
    limit:   vi.fn().mockResolvedValue(result),
    single:  vi.fn().mockResolvedValue(result),
  }
  return chain
}

const BASE_BODY = { orgId: ORG_ID, recipientId: REC_ID, format: 'json' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any)
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('POST /api/export — auth', () => {
  it('returns 401 when no user', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null)
    const res = await POST(makeReq(BASE_BODY))
    expect(res.status).toBe(401)
  })
})

// ─── Validation ───────────────────────────────────────────────────────────────

describe('POST /api/export — validation', () => {
  it('returns 400 for missing orgId', async () => {
    const res = await POST(makeReq({ recipientId: REC_ID, format: 'json' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid format value', async () => {
    const res = await POST(makeReq({ ...BASE_BODY, format: 'xml' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid since (non-ISO)', async () => {
    const res = await POST(makeReq({ ...BASE_BODY, since: 'yesterday' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing recipientId', async () => {
    const res = await POST(makeReq({ orgId: ORG_ID, format: 'json' }))
    expect(res.status).toBe(400)
  })
})

// ─── Role enforcement ────────────────────────────────────────────────────────

describe('POST /api/export — role', () => {
  it('returns 403 when role is caregiver', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeChain({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null })
    )
    const res = await POST(makeReq(BASE_BODY))
    expect(res.status).toBe(403)
  })

  it('returns 403 when membership is null (non-member)', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeChain({ data: null, error: { message: 'not found' } })
    )
    const res = await POST(makeReq(BASE_BODY))
    expect(res.status).toBe(403)
  })

  it('returns 403 when coordinator has pending invite (accepted_at is null)', async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeChain({ data: { role: 'coordinator', accepted_at: null }, error: null })
    )
    const res = await POST(makeReq(BASE_BODY))
    expect(res.status).toBe(403)
  })
})

// ─── Data fetching ────────────────────────────────────────────────────────────

describe('POST /api/export — data fetching', () => {
  it('returns 404 when care_recipient not found', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'memberships')     return makeChain({ data: { role: 'coordinator', accepted_at: new Date().toISOString() }, error: null })
      if (table === 'care_recipients') return makeChain({ data: null, error: { message: 'not found' } })
      return makeChain({ data: [], error: null })
    })
    const res = await POST(makeReq(BASE_BODY))
    expect(res.status).toBe(404)
  })

  it('returns 404 when identity vault not found', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'memberships')     return makeChain({ data: { role: 'coordinator', accepted_at: new Date().toISOString() }, error: null })
      if (table === 'care_recipients') return makeChain({ data: { identity_token: 'tok' }, error: null })
      if (table === 'identity_vault')  return makeChain({ data: null, error: { message: 'not found' } })
      return makeChain({ data: [], error: null })
    })
    const res = await POST(makeReq(BASE_BODY))
    expect(res.status).toBe(404)
  })
})

// ─── JSON export ──────────────────────────────────────────────────────────────

describe('POST /api/export — JSON format', () => {
  it('returns 200 application/json with correct top-level keys', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'memberships')      return makeChain({ data: { role: 'coordinator', accepted_at: new Date().toISOString() }, error: null })
      if (table === 'care_recipients')  return makeChain({ data: { identity_token: 'vault-token-abc' }, error: null })
      if (table === 'identity_vault')   return makeChain({ data: { full_name: 'Alice Smith', dob: '1940-06-01' }, error: null })
      // care_events, symptom_readings, medications, shifts
      return makeChain({ data: [], error: null })
    })

    const res = await POST(makeReq(BASE_BODY))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    const body = await res.json()
    expect(body).toHaveProperty('recipient_name', 'Alice Smith')
    expect(body).toHaveProperty('dob', '1940-06-01')
    expect(body).toHaveProperty('care_events')
    expect(body).toHaveProperty('symptom_readings')
    expect(body).toHaveProperty('medications')
    expect(body).toHaveProperty('shifts')
    expect(body).toHaveProperty('exported_at')
  })

  it('includes since in response body when provided', async () => {
    const sinceDate = '2026-01-01T00:00:00Z'
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === 'memberships')     return makeChain({ data: { role: 'coordinator', accepted_at: new Date().toISOString() }, error: null })
      if (table === 'care_recipients') return makeChain({ data: { identity_token: 'tok' }, error: null })
      if (table === 'identity_vault')  return makeChain({ data: { full_name: 'Bob', dob: null }, error: null })
      return makeChain({ data: [], error: null })
    })

    const res = await POST(makeReq({ ...BASE_BODY, since: sinceDate }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('since', sinceDate)
  })
})
