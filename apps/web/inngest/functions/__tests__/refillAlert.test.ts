// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { detectLowSupply, type MedicationRow } from '../refillAlert'

const BASE: MedicationRow = {
  id:                    '00000000-0000-0000-0000-000000000001',
  org_id:                '00000000-0000-0000-0000-000000000002',
  recipient_id:          '00000000-0000-0000-0000-000000000003',
  drug_name:             'Lisinopril',
  supply_days_remaining: 5,
}

describe('detectLowSupply', () => {
  it('returns medications with supply_days_remaining <= 7', () => {
    const meds = [
      { ...BASE, id: '1', supply_days_remaining: 0 },
      { ...BASE, id: '2', supply_days_remaining: 3 },
      { ...BASE, id: '3', supply_days_remaining: 7 },
      { ...BASE, id: '4', supply_days_remaining: 8 },
      { ...BASE, id: '5', supply_days_remaining: 30 },
    ]
    const low = detectLowSupply(meds)
    expect(low).toHaveLength(3)
    expect(low.map(m => m.id)).toEqual(['1', '2', '3'])
  })

  it('returns empty array when all medications have sufficient supply', () => {
    const meds = [
      { ...BASE, id: '1', supply_days_remaining: 10 },
      { ...BASE, id: '2', supply_days_remaining: 30 },
    ]
    expect(detectLowSupply(meds)).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(detectLowSupply([])).toHaveLength(0)
  })

  it('includes medications with exactly 7 days remaining', () => {
    const meds = [{ ...BASE, supply_days_remaining: 7 }]
    expect(detectLowSupply(meds)).toHaveLength(1)
  })

  it('excludes medications with exactly 8 days remaining', () => {
    const meds = [{ ...BASE, supply_days_remaining: 8 }]
    expect(detectLowSupply(meds)).toHaveLength(0)
  })
})
