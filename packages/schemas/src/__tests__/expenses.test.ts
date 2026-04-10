import { describe, it, expect } from 'vitest'
import { expenseCreateInput, expenseListInput } from '../expenses'

const BASE = {
  org_id:       '00000000-0000-0000-0000-000000000001',
  recipient_id: '00000000-0000-0000-0000-000000000002',
  amount:       42.50,
  category:     'medication' as const,
  description:  'Aspirin refill',
}

describe('expenseCreateInput', () => {
  it('accepts a valid full input', () => {
    expect(expenseCreateInput.safeParse(BASE).success).toBe(true)
  })

  it('accepts optional paid_by_name and incurred_at', () => {
    const result = expenseCreateInput.safeParse({
      ...BASE,
      paid_by_name: 'Brady',
      incurred_at:  '2026-04-09',
    })
    expect(result.success).toBe(true)
  })

  it('rejects amount of 0', () => {
    expect(expenseCreateInput.safeParse({ ...BASE, amount: 0 }).success).toBe(false)
  })

  it('rejects negative amount', () => {
    expect(expenseCreateInput.safeParse({ ...BASE, amount: -5 }).success).toBe(false)
  })

  it('rejects invalid category', () => {
    expect(expenseCreateInput.safeParse({ ...BASE, category: 'vacation' }).success).toBe(false)
  })

  it('rejects empty description', () => {
    expect(expenseCreateInput.safeParse({ ...BASE, description: '' }).success).toBe(false)
  })

  it('rejects non-uuid org_id', () => {
    expect(expenseCreateInput.safeParse({ ...BASE, org_id: 'not-a-uuid' }).success).toBe(false)
  })

  it('accepts all valid categories', () => {
    const categories = ['medication','supplies','equipment','home_modification','aide_hours','transport','food','other']
    for (const category of categories) {
      expect(expenseCreateInput.safeParse({ ...BASE, category }).success).toBe(true)
    }
  })
})

describe('expenseListInput', () => {
  it('accepts valid org_id and recipient_id', () => {
    expect(expenseListInput.safeParse({
      org_id: '00000000-0000-0000-0000-000000000001',
      recipient_id: '00000000-0000-0000-0000-000000000002',
    }).success).toBe(true)
  })

  it('accepts optional since date', () => {
    expect(expenseListInput.safeParse({
      org_id: '00000000-0000-0000-0000-000000000001',
      recipient_id: '00000000-0000-0000-0000-000000000002',
      since: '2026-01-01',
    }).success).toBe(true)
  })
})
