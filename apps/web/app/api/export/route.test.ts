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
  const chain: any = {
    select:  () => chain,
    eq:      () => chain,
    not:     () => chain,
    gte:     () => chain,
    order:   () => chain,
    limit:   vi.fn().mockResolvedValue(result),
  }
  chain.single = vi.fn().mockResolvedValue(result)
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
})

// ─── JSON export ──────────────────────────────────────────────────────────────

describe('POST /api/export — JSON format', () => {
  it('returns 200 application/json with correct top-level keys', async () => {
    let callCount = 0
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++
      // Call 1: membership check
      if (callCount === 1) return makeChain({ data: { role: 'coordinator', accepted_at: new Date().toISOString() }, error: null })
      // Call 2: care_recipients (identity_token)
      if (callCount === 2) return makeChain({ data: { identity_token: 'vault-token-abc' }, error: null })
      // Call 3: identity_vault
      if (callCount === 3) return makeChain({ data: { full_name: 'Alice Smith', dob: '1940-06-01' }, error: null })
      // Calls 4-7: care_events, symptom_readings, medications, shifts
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
})
