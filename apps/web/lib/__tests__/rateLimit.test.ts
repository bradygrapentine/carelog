import { describe, it, expect } from 'vitest'
import { getClientIp } from '../rateLimit'

function makeRequest(headers: Record<string, string>) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as any
}

describe('getClientIp', () => {
  it('prefers x-real-ip over x-forwarded-for', () => {
    const req = makeRequest({
      'x-real-ip': '1.2.3.4',
      'x-forwarded-for': '9.9.9.9, 8.8.8.8',
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('returns the last x-forwarded-for entry when no x-real-ip', () => {
    // First entry is attacker-controlled; last is the trusted upstream proxy
    const req = makeRequest({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8, 1.2.3.4' })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('handles a single x-forwarded-for entry', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('returns unknown when neither header is present', () => {
    const req = makeRequest({})
    expect(getClientIp(req)).toBe('unknown')
  })
})
