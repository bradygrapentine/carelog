import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /api/health/crons', () => {
  it('returns 200 with status ok', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
  })

  it('returns an array of 6 cron entries', async () => {
    const response = await GET()
    const body = await response.json()
    expect(Array.isArray(body.crons)).toBe(true)
    expect(body.crons).toHaveLength(6)
  })
})
