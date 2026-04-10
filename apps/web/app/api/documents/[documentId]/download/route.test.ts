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
import { GET }            from './route'

const USER_ID = '30000000-0000-0000-0000-000000000003'
const DOC_ID  = '40000000-0000-0000-0000-000000000004'
const ORG_ID  = '10000000-0000-0000-0000-000000000001'

function makeReq() {
  return new NextRequest('http://localhost/api/documents/' + DOC_ID + '/download', { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getRequestUser).mockResolvedValue({ id: USER_ID } as any)
})

describe('GET /api/documents/[documentId]/download — auth', () => {
  it('returns 401 when no user', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null)
    const res = await GET(makeReq(), { params: Promise.resolve({ documentId: DOC_ID }) })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/documents/[documentId]/download — not found', () => {
  it('returns 404 when document does not exist', async () => {
    const docChain = {
      select: () => docChain,
      eq:     () => docChain,
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }
    vi.mocked(supabaseAdmin.from).mockReturnValue(docChain as any)
    const res = await GET(makeReq(), { params: Promise.resolve({ documentId: DOC_ID }) })
    expect(res.status).toBe(404)
  })
})

describe('GET /api/documents/[documentId]/download — role check', () => {
  it('returns 403 when user is not an org member', async () => {
    const docChain = {
      select: () => docChain,
      eq:     () => docChain,
      single: vi.fn().mockResolvedValue({
        data: { id: DOC_ID, org_id: ORG_ID, storage_path: 'test/file.pdf' },
        error: null,
      }),
    }
    const memberChain = {
      select: () => memberChain,
      eq:     () => memberChain,
      not:    () => memberChain,
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(docChain as any)
      .mockReturnValueOnce(memberChain as any)
    const res = await GET(makeReq(), { params: Promise.resolve({ documentId: DOC_ID }) })
    expect(res.status).toBe(403)
  })
})

describe('GET /api/documents/[documentId]/download — signed URL', () => {
  it('redirects to signed URL when everything is valid', async () => {
    const docChain = {
      select: () => docChain,
      eq:     () => docChain,
      single: vi.fn().mockResolvedValue({
        data: { id: DOC_ID, org_id: ORG_ID, storage_path: 'test/file.pdf' },
        error: null,
      }),
    }
    const memberChain = {
      select: () => memberChain,
      eq:     () => memberChain,
      not:    () => memberChain,
      single: vi.fn().mockResolvedValue({ data: { role: 'supporter' }, error: null }),
    }
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(docChain as any)
      .mockReturnValueOnce(memberChain as any)

    const storageChain = {
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://storage.example.com/signed-url' },
        error: null,
      }),
    }
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue(storageChain as any)

    const res = await GET(makeReq(), { params: Promise.resolve({ documentId: DOC_ID }) })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://storage.example.com/signed-url')
  })
})
