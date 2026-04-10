import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn(),
}))
vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: {
    from:    vi.fn(),
    storage: { from: vi.fn() },
  },
}))

import { getRequestUser } from '@/lib/supabaseServer'
import { supabaseAdmin }  from '@/server/supabaseAdmin.server'
import { POST }           from './route'

const ORG_ID  = '10000000-0000-0000-0000-000000000001'
const REC_ID  = '20000000-0000-0000-0000-000000000002'
const USER_ID = '30000000-0000-0000-0000-000000000003'

function makeFile() {
  return new File(['pdf-content'], 'test.pdf', { type: 'application/pdf' })
}

function makeFormData(fields: Record<string, string>, includeFile = true) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, v)
  }
  if (includeFile) {
    form.append('file', makeFile())
  }
  return form
}

function makeReq(formData: FormData) {
  const req = new NextRequest('http://localhost/api/documents/upload', { method: 'POST' })
  vi.spyOn(req, 'formData').mockResolvedValue(formData)
  return req
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any)
})

describe('POST /api/documents/upload — auth', () => {
  it('returns 401 when no user', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null)
    const res = await POST(makeReq(makeFormData({ orgId: ORG_ID, recipientId: REC_ID, displayName: 'Test', docType: 'other' })))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/documents/upload — role check', () => {
  it('returns 403 when user is not coordinator', async () => {
    const memberChain = {
      select: () => memberChain,
      eq:     () => memberChain,
      not:    () => memberChain,
      single: vi.fn().mockResolvedValue({ data: { role: 'caregiver', accepted_at: new Date().toISOString() }, error: null }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(memberChain as any)
    const res = await POST(makeReq(makeFormData({ orgId: ORG_ID, recipientId: REC_ID, displayName: 'Test', docType: 'other' })))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/documents/upload — validation', () => {
  it('returns 400 when displayName is missing', async () => {
    const form = makeFormData({ orgId: ORG_ID, recipientId: REC_ID, docType: 'other' })
    const res = await POST(makeReq(form))
    expect(res.status).toBe(400)
  })
})
