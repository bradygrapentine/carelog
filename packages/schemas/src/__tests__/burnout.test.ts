import { describe, it, expect } from 'vitest'
import { burnoutCheckInInput, burnoutListInput } from '../burnout'

const BASE = {
  org_id:        '00000000-0000-0000-0000-000000000001',
  user_id:       '00000000-0000-0000-0000-000000000002',
  sleep_score:   3,
  stress_score:  2,
  support_score: 4,
  week_stamp:    '2026-W14',
}

describe('burnoutCheckInInput', () => {
  it('accepts a valid full input', () => {
    const result = burnoutCheckInInput.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('accepts input without optional notes', () => {
    const result = burnoutCheckInInput.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('accepts input with optional notes', () => {
    const result = burnoutCheckInInput.safeParse({ ...BASE, notes: 'Feeling stretched thin.' })
    expect(result.success).toBe(true)
  })

  it('rejects sleep_score of 0 (minimum is 1)', () => {
    const result = burnoutCheckInInput.safeParse({ ...BASE, sleep_score: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects stress_score of 6 (maximum is 5)', () => {
    const result = burnoutCheckInInput.safeParse({ ...BASE, stress_score: 6 })
    expect(result.success).toBe(false)
  })

  it('rejects support_score below 1', () => {
    const result = burnoutCheckInInput.safeParse({ ...BASE, support_score: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects malformed week_stamp missing W prefix', () => {
    const result = burnoutCheckInInput.safeParse({ ...BASE, week_stamp: '2026-14' })
    expect(result.success).toBe(false)
  })

  it('rejects week_stamp in ISO date format', () => {
    const result = burnoutCheckInInput.safeParse({ ...BASE, week_stamp: '2026-04-01' })
    expect(result.success).toBe(false)
  })

  it('accepts week_stamp in correct YYYY-Www format', () => {
    const result = burnoutCheckInInput.safeParse({ ...BASE, week_stamp: '2026-W01' })
    expect(result.success).toBe(true)
  })

  it('rejects notes longer than 500 characters', () => {
    const result = burnoutCheckInInput.safeParse({ ...BASE, notes: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })
})

describe('burnoutListInput', () => {
  it('accepts valid org_id', () => {
    const result = burnoutListInput.safeParse({ org_id: '00000000-0000-0000-0000-000000000001' })
    expect(result.success).toBe(true)
  })

  it('rejects non-uuid org_id', () => {
    const result = burnoutListInput.safeParse({ org_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})
