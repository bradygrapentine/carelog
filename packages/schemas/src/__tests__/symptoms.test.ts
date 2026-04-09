import { describe, it, expect } from 'vitest'
import { symptomLogInput, symptomListInput } from '../symptoms'

const BASE_LOG = {
  org_id:       '00000000-0000-0000-0000-000000000001',
  recipient_id: '00000000-0000-0000-0000-000000000002',
}

describe('symptomLogInput', () => {
  it('accepts valid input with all optional fields omitted', () => {
    const result = symptomLogInput.safeParse(BASE_LOG)
    expect(result.success).toBe(true)
  })

  it('accepts full valid input', () => {
    const result = symptomLogInput.safeParse({
      ...BASE_LOG,
      pain_level: 6,
      mood:       'difficult',
      appetite:   'reduced',
      mobility:   'limited',
      notes:      'Complained of headache all morning.',
    })
    expect(result.success).toBe(true)
  })

  it('rejects pain_level > 10', () => {
    const result = symptomLogInput.safeParse({ ...BASE_LOG, pain_level: 11 })
    expect(result.success).toBe(false)
  })

  it('rejects pain_level < 0', () => {
    const result = symptomLogInput.safeParse({ ...BASE_LOG, pain_level: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid mood value', () => {
    const result = symptomLogInput.safeParse({ ...BASE_LOG, mood: 'great' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid appetite value', () => {
    const result = symptomLogInput.safeParse({ ...BASE_LOG, appetite: 'a lot' })
    expect(result.success).toBe(false)
  })

  it('rejects notes longer than 1000 characters', () => {
    const result = symptomLogInput.safeParse({ ...BASE_LOG, notes: 'x'.repeat(1001) })
    expect(result.success).toBe(false)
  })

  it('rejects invalid org_id uuid', () => {
    const result = symptomLogInput.safeParse({ ...BASE_LOG, org_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('symptomListInput', () => {
  it('accepts valid org_id and recipient_id', () => {
    const result = symptomListInput.safeParse(BASE_LOG)
    expect(result.success).toBe(true)
  })

  it('rejects missing recipient_id', () => {
    const result = symptomListInput.safeParse({ org_id: BASE_LOG.org_id })
    expect(result.success).toBe(false)
  })
})
