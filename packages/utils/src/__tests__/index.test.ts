import { describe, it, expect } from 'vitest'
import {
  digestMinuteOffset,
  getWeekStamp,
  getDayStamp,
  truncate,
  formatCurrency,
  safeParseJson,
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

describe('getWeekStamp', () => {
  it('returns a string matching YYYY-WN format', () => {
    expect(getWeekStamp()).toMatch(/^\d{4}-W\d{1,2}$/)
  })

  it('returns same value when called twice in the same week', () => {
    expect(getWeekStamp()).toBe(getWeekStamp())
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