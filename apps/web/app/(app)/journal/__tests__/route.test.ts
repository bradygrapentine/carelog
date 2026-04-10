import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFrom = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

import { GET, POST } from '../route'

function makeSelectChain(result: object) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq     = vi.fn().mockReturnValue(chain)
  chain.order  = vi.fn().mockReturnValue(chain)
  chain.limit  = vi.fn().mockResolvedValue(result)
  return chain
}

function makeInsertChain(result: object) {
  const chain: Record<string, unknown> = {}
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.select = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue(result)
  return chain
}

describe('GET /api/journal', () => {
  beforeEach(() => { mockFrom.mockReset() })

  it('returns 400 when recipientId is missing', async () => {
    const req = new NextRequest('http://localhost/api/journal')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/recipientId/)
  })

  it('returns 500 when the DB query fails', async () => {
    mockFrom.mockReturnValue(makeSelectChain({ data: null, error: { message: 'DB error' } }))
    const req = new NextRequest('http://localhost/api/journal?recipientId=r1')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('DB error')
  })

  it('returns 200 with events array on success', async () => {
    const events = [{ id: 'e1', event_type: 'journal' }]
    mockFrom.mockReturnValue(makeSelectChain({ data: events, error: null }))
    const req = new NextRequest('http://localhost/api/journal?recipientId=r1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.events).toEqual(events)
  })

  it('returns empty array when DB returns null data', async () => {
    mockFrom.mockReturnValue(makeSelectChain({ data: null, error: null }))
    const req = new NextRequest('http://localhost/api/journal?recipientId=r1')
    const res = await GET(req)
    const body = await res.json()
    expect(body.events).toEqual([])
  })
})

describe('POST /api/journal', () => {
  beforeEach(() => { mockFrom.mockReset() })

  it('returns 400 when required fields are missing', async () => {
    const req = new NextRequest('http://localhost/api/journal', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 'r1', orgId: 'o1' }), // missing text + userId
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns 500 when the DB insert fails', async () => {
    mockFrom.mockReturnValue(makeInsertChain({ data: null, error: { message: 'insert failed' } }))
    const req = new NextRequest('http://localhost/api/journal', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 'r1', orgId: 'o1', text: 'Hello', userId: 'u1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('returns 200 with the inserted event on success', async () => {
    const event = { id: 'e1', event_type: 'journal', entry_kind: 'human' }
    mockFrom.mockReturnValue(makeInsertChain({ data: event, error: null }))
    const req = new NextRequest('http://localhost/api/journal', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 'r1', orgId: 'o1', text: 'Hello', userId: 'u1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.event).toEqual(event)
  })

  it('passes mood in the payload when provided', async () => {
    const chain = makeInsertChain({ data: { id: 'e1' }, error: null })
    mockFrom.mockReturnValue(chain)
    const req = new NextRequest('http://localhost/api/journal', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 'r1', orgId: 'o1', text: 'Good day', mood: 'good', userId: 'u1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { text: 'Good day', mood: 'good' } })
    )
  })

  it('sets mood to null when not provided', async () => {
    const chain = makeInsertChain({ data: { id: 'e1' }, error: null })
    mockFrom.mockReturnValue(chain)
    const req = new NextRequest('http://localhost/api/journal', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 'r1', orgId: 'o1', text: 'Just a note', userId: 'u1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { text: 'Just a note', mood: null } })
    )
  })

  it('sets entry_kind to human and event_type to journal', async () => {
    const chain = makeInsertChain({ data: { id: 'e1' }, error: null })
    mockFrom.mockReturnValue(chain)
    const req = new NextRequest('http://localhost/api/journal', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 'r1', orgId: 'o1', text: 'Test', userId: 'u1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ entry_kind: 'human', event_type: 'journal' })
    )
  })
})
