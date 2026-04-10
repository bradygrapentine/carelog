import { describe, it, expect } from 'vitest'
import { eligibility } from '../benefitsEligibility'

const NONE = {
  age65plus:        false,
  veteran:          false,
  lowIncome:        false,
  medicareEnrolled: false,
  medicaidEnrolled: false,
}

describe('eligibility — no matches', () => {
  it('returns empty array when no criteria match', () => {
    expect(eligibility(NONE)).toHaveLength(0)
  })
})

describe('eligibility — Medicare Part D Extra Help', () => {
  it('matches when age65plus + lowIncome + medicareEnrolled', () => {
    const results = eligibility({ ...NONE, age65plus: true, lowIncome: true, medicareEnrolled: true })
    expect(results.map(r => r.key)).toContain('medicare_part_d_extra_help')
  })

  it('does NOT match when not on Medicare', () => {
    const results = eligibility({ ...NONE, age65plus: true, lowIncome: true, medicareEnrolled: false })
    expect(results.map(r => r.key)).not.toContain('medicare_part_d_extra_help')
  })
})

describe('eligibility — Medicaid HCBS Waiver', () => {
  it('matches when age65plus + lowIncome (Medicaid-eligible)', () => {
    const results = eligibility({ ...NONE, age65plus: true, lowIncome: true })
    expect(results.map(r => r.key)).toContain('medicaid_hcbs_waiver')
  })

  it('does NOT match when income is not low', () => {
    const results = eligibility({ ...NONE, age65plus: true, lowIncome: false })
    expect(results.map(r => r.key)).not.toContain('medicaid_hcbs_waiver')
  })
})

describe('eligibility — VA Aid & Attendance', () => {
  it('matches when veteran + age65plus', () => {
    const results = eligibility({ ...NONE, veteran: true, age65plus: true })
    expect(results.map(r => r.key)).toContain('va_aid_attendance')
  })

  it('does NOT match non-veteran', () => {
    const results = eligibility({ ...NONE, veteran: false, age65plus: true })
    expect(results.map(r => r.key)).not.toContain('va_aid_attendance')
  })
})

describe('eligibility — PACE Program', () => {
  it('matches when age65plus + medicaidEnrolled', () => {
    const results = eligibility({ ...NONE, age65plus: true, medicaidEnrolled: true })
    expect(results.map(r => r.key)).toContain('pace_program')
  })

  it('does NOT match without Medicaid', () => {
    const results = eligibility({ ...NONE, age65plus: true, medicaidEnrolled: false })
    expect(results.map(r => r.key)).not.toContain('pace_program')
  })
})

describe('eligibility — SHIP Counseling', () => {
  it('matches when age65plus (always available to seniors)', () => {
    const results = eligibility({ ...NONE, age65plus: true })
    expect(results.map(r => r.key)).toContain('ship_counseling')
  })

  it('does NOT match for non-seniors', () => {
    const results = eligibility({ ...NONE, age65plus: false })
    expect(results.map(r => r.key)).not.toContain('ship_counseling')
  })
})

describe('eligibility — result shape', () => {
  it('each result has key, name, description, applyUrl', () => {
    const results = eligibility({ ...NONE, age65plus: true })
    for (const r of results) {
      expect(r).toHaveProperty('key')
      expect(r).toHaveProperty('name')
      expect(r).toHaveProperty('description')
      expect(r).toHaveProperty('applyUrl')
    }
  })
})
