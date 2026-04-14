import { describe, it, expect } from 'vitest'
import {
  outerCircleRequestCreateInput,
  outerCircleDeactivateInput,
  outerCircleListInput,
} from '../outerCircle'

const VALID_UUID_A = '00000000-0000-0000-0000-000000000001'
const VALID_UUID_B = '00000000-0000-0000-0000-000000000002'

describe('outerCircleRequestCreateInput', () => {
  const BASE = {
    org_id:       VALID_UUID_A,
    recipient_id: VALID_UUID_B,
    title:        'Meal delivery',
    request_type: 'meal' as const,
  }

  it('accepts minimal valid input (no optional fields)', () => {
    const result = outerCircleRequestCreateInput.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('accepts full input with all optional fields', () => {
    const result = outerCircleRequestCreateInput.safeParse({
      ...BASE,
      description: 'Gluten-free preferred',
      slots_total: 3,
      needed_by:   '2026-05-01T12:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('applies default slots_total of 1 when omitted', () => {
    const result = outerCircleRequestCreateInput.safeParse(BASE)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.slots_total).toBe(1)
    }
  })

  it('accepts all valid request_type values', () => {
    const types = ['meal', 'transport', 'errand', 'visit', 'other'] as const
    for (const request_type of types) {
      const result = outerCircleRequestCreateInput.safeParse({ ...BASE, request_type })
      expect(result.success).toBe(true)
    }
  })

  it('rejects an invalid request_type', () => {
    const result = outerCircleRequestCreateInput.safeParse({ ...BASE, request_type: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('rejects empty title', () => {
    const result = outerCircleRequestCreateInput.safeParse({ ...BASE, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects title longer than 200 characters', () => {
    const result = outerCircleRequestCreateInput.safeParse({ ...BASE, title: 'x'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects description longer than 1000 characters', () => {
    const result = outerCircleRequestCreateInput.safeParse({
      ...BASE,
      description: 'x'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects slots_total of 0 (minimum is 1)', () => {
    const result = outerCircleRequestCreateInput.safeParse({ ...BASE, slots_total: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects slots_total of 21 (maximum is 20)', () => {
    const result = outerCircleRequestCreateInput.safeParse({ ...BASE, slots_total: 21 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer slots_total', () => {
    const result = outerCircleRequestCreateInput.safeParse({ ...BASE, slots_total: 1.5 })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID org_id', () => {
    const result = outerCircleRequestCreateInput.safeParse({ ...BASE, org_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID recipient_id', () => {
    const result = outerCircleRequestCreateInput.safeParse({ ...BASE, recipient_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed needed_by datetime', () => {
    const result = outerCircleRequestCreateInput.safeParse({ ...BASE, needed_by: '2026-05-01' })
    expect(result.success).toBe(false)
  })
})

describe('outerCircleDeactivateInput', () => {
  const BASE = {
    id:     VALID_UUID_A,
    org_id: VALID_UUID_B,
  }

  it('accepts a valid deactivate input', () => {
    const result = outerCircleDeactivateInput.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID id', () => {
    const result = outerCircleDeactivateInput.safeParse({ ...BASE, id: 'bad-id' })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID org_id', () => {
    const result = outerCircleDeactivateInput.safeParse({ ...BASE, org_id: 'bad-org' })
    expect(result.success).toBe(false)
  })

  it('rejects missing id', () => {
    const result = outerCircleDeactivateInput.safeParse({ org_id: VALID_UUID_B })
    expect(result.success).toBe(false)
  })
})

describe('outerCircleListInput', () => {
  it('accepts valid org_id and recipient_id', () => {
    const result = outerCircleListInput.safeParse({
      org_id:       VALID_UUID_A,
      recipient_id: VALID_UUID_B,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID org_id', () => {
    const result = outerCircleListInput.safeParse({
      org_id:       'not-a-uuid',
      recipient_id: VALID_UUID_B,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing recipient_id', () => {
    const result = outerCircleListInput.safeParse({ org_id: VALID_UUID_A })
    expect(result.success).toBe(false)
  })
})
