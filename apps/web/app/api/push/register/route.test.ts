import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUpsert, mockFrom } = vi.hoisted(() => {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })
  const mockFrom = vi.fn(() => ({ upsert: mockUpsert }))
  return { mockUpsert, mockFrom }
})

vi.mock('@/server/supabaseAdmin.server', () => ({
  supabaseAdmin: { from: mockFrom },
}))

vi.mock('@/lib/supabaseServer', () => ({
  getRequestUser: vi.fn().mockResolvedValue({ id: 'user-123' }),
}))

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}))

import { POST } from './route'
import { NextRequest } from 'next/server'
import { getRequestUser } from '@/lib/supabaseServer'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/push/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/push/register', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 for invalid platform', async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: 'user-123' } as any)
    const res = await POST(makeRequest({ token: 'ExpoToken[xxx]', platform: 'windows' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing token', async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: 'user-123' } as any)
    const res = await POST(makeRequest({ platform: 'ios' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getRequestUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ token: 'ExpoToken[xxx]', platform: 'ios' }))
    expect(res.status).toBe(401)
  })

  it('upserts token and returns 200', async () => {
    vi.mocked(getRequestUser).mockResolvedValue({ id: 'user-123' } as any)
    const res = await POST(makeRequest({ token: 'ExpoToken[abc]', platform: 'ios' }))
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('push_tokens')
    expect(mockUpsert).toHaveBeenCalledWith(
      { auth_user_id: 'user-123', token: 'ExpoToken[abc]', platform: 'ios' },
      { onConflict: 'token' },
    )
  })
})
