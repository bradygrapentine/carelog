import { describe, it, expect } from 'vitest'
import {
  digestMinuteOffset,
  isoWeekStamp,
  getDayStamp,
  truncate,
  formatCurrency,
  safeParseJson,
  randomHexToken,
} from '../index'

describe('digestMinuteOffset', () => {
  it('is deterministic — same input always returns same output', () => {
    const orgId = '18dc6d19-6712-4b26-8797-b4e544e01b84'
    expect(digestMinuteOffset(orgId)).toBe(digestMinuteOffset(orgId))
  })

  it('stays within the 4-hour (240 minute) window', () => {
    const ids = [
      '18dc6d19-6712-4b26-8797-b4e544e01b84',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      '00000000-0000-0000-0000-000000000001',
    ]
    for (const id of ids) {
      const offset = digestMinuteOffset(id)
      expect(offset).toBeGreaterThanOrEqual(0)
      expect(offset).toBeLessThan(240)
    }
  })

  it('produces different offsets for different org IDs', () => {
    const a = digestMinuteOffset('18dc6d19-6712-4b26-8797-b4e544e01b84')
    const b = digestMinuteOffset('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(a).not.toBe(b)
  })
})

describe('isoWeekStamp', () => {
  it('returns W53 for a 53-week ISO year (2026-12-28 Monday)', () => {
    // 2026 has 53 ISO weeks. 2026-12-28 is a Monday — start of W53.
    expect(isoWeekStamp(new Date('2026-12-28T00:00:00Z'))).toBe('2026-W53')
  })

  it('treats Sunday 2024-12-29 as ISO week 52 of 2024', () => {
    // ISO 8601 §3.4: Thursday of that week (2024-12-26) falls in 2024 → W52.
    expect(isoWeekStamp(new Date('2024-12-29T00:00:00Z'))).toBe('2024-W52')
  })

  it('returns 2025-W23 for midweek Wednesday 2025-06-04', () => {
    expect(isoWeekStamp(new Date('2025-06-04T00:00:00Z'))).toBe('2025-W23')
  })

  it('zero-pads single-digit week numbers (YYYY-W04, not YYYY-W4)', () => {
    // 2025-01-22 is a Wednesday → ISO week 4 of 2025.
    expect(isoWeekStamp(new Date('2025-01-22T00:00:00Z'))).toBe('2025-W04')
  })

  it('is TZ-deterministic — same instant in different wall-clock zones yields same stamp', () => {
    // Both Date values reference the exact same UTC instant (2026-01-05T07:00:00Z).
    const pacific = isoWeekStamp(new Date('2026-01-04T23:00:00-08:00'))
    const utc = isoWeekStamp(new Date('2026-01-05T07:00:00Z'))
    expect(pacific).toBe(utc)
  })
})

describe('getDayStamp', () => {
  it('returns a string matching YYYY-MM-DD format', () => {
    expect(getDayStamp()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches current date', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(getDayStamp()).toBe(today)
  })
})

describe('truncate', () => {
  it('returns string unchanged if under max length', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates and adds ellipsis if over max length', () => {
    const result = truncate('hello world', 8)
    expect(result).toBe('hello...')
    expect(result.length).toBe(8)
  })

  it('handles exact max length', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })
})

describe('formatCurrency', () => {
  it('formats cents to USD', () => {
    const result = formatCurrency(1499, 'USD', 'en-US')
    expect(result).toContain('14.99')
  })

  it('formats zero correctly', () => {
    const result = formatCurrency(0, 'USD', 'en-US')
    expect(result).toContain('0.00')
  })
})

describe('safeParseJson', () => {
  it('parses valid JSON', () => {
    expect(safeParseJson('{"key":"value"}', {})).toEqual({ key: 'value' })
  })

  it('returns fallback for invalid JSON', () => {
    expect(safeParseJson('not json', { fallback: true })).toEqual({ fallback: true })
  })

  it('returns fallback for empty string', () => {
    expect(safeParseJson('', null)).toBe(null)
  })
})

describe('randomHexToken', () => {
  it('returns a hex string of the correct length', () => {
    expect(randomHexToken(16)).toHaveLength(32) // 16 bytes = 32 hex chars
    expect(randomHexToken(32)).toHaveLength(64) // default
  })

  it('returns only hex characters', () => {
    expect(randomHexToken()).toMatch(/^[0-9a-f]+$/)
  })

  it('returns different values on successive calls', () => {
    expect(randomHexToken()).not.toBe(randomHexToken())
  })
})