import { describe, it, expect } from 'vitest'
import { medicationCreateInput, medicationUpdateInput } from '../medications'

const BASE = {
  org_id:       '00000000-0000-0000-0000-000000000001',
  recipient_id: '00000000-0000-0000-0000-000000000002',
  drug_name:    'Lisinopril',
  dosage:       '10mg once daily',
}

describe('medicationCreateInput', () => {
  it('accepts minimal valid input', () => {
    const result = medicationCreateInput.parse(BASE)
    expect(result.drug_name).toBe('Lisinopril')
    expect(result.scan_source).toBeUndefined()
  })

  it('accepts full optional fields', () => {
    const result = medicationCreateInput.parse({
      ...BASE,
      brand_name:            'Zestril',
      form:                  'tablet',
      instructions:          'Take with food',
      prescriber:            'Dr. Smith',
      pharmacy:              'CVS on Main St',
      pharmacy_phone:        '555-1234',
      refills_remaining:     3,
      supply_days_remaining: 30,
      last_refill_date:      '2026-04-01',
    })
    expect(result.brand_name).toBe('Zestril')
    expect(result.supply_days_remaining).toBe(30)
  })

  it('rejects empty drug_name', () => {
    expect(() => medicationCreateInput.parse({ ...BASE, drug_name: '' })).toThrow()
  })

  it('rejects empty dosage', () => {
    expect(() => medicationCreateInput.parse({ ...BASE, dosage: '' })).toThrow()
  })

  it('rejects negative supply_days_remaining', () => {
    expect(() => medicationCreateInput.parse({ ...BASE, supply_days_remaining: -1 })).toThrow()
  })

  it('rejects invalid org_id uuid', () => {
    expect(() => medicationCreateInput.parse({ ...BASE, org_id: 'not-a-uuid' })).toThrow()
  })
})

describe('medicationUpdateInput', () => {
  it('accepts supply update', () => {
    const result = medicationUpdateInput.parse({
      id:                    '00000000-0000-0000-0000-000000000003',
      org_id:                '00000000-0000-0000-0000-000000000001',
      supply_days_remaining: 14,
    })
    expect(result.supply_days_remaining).toBe(14)
  })

  it('accepts active=false (soft delete)', () => {
    const result = medicationUpdateInput.parse({
      id:     '00000000-0000-0000-0000-000000000003',
      org_id: '00000000-0000-0000-0000-000000000001',
      active: false,
    })
    expect(result.active).toBe(false)
  })
})
