import { describe, it, expect } from 'vitest'
import { createOrgSchema, updateOrgSchema } from '../organizations'

describe('createOrgSchema', () => {
  it('accepts valid org with all org types', () => {
    for (const org_type of ['family', 'agency', 'institution', 'employer'] as const) {
      expect(() =>
        createOrgSchema.parse({ name: 'Test Org', org_type })
      ).not.toThrow()
    }
  })

  it('rejects empty name', () => {
    expect(() =>
      createOrgSchema.parse({ name: '', org_type: 'family' })
    ).toThrow()
  })

  it('rejects name over 100 characters', () => {
    expect(() =>
      createOrgSchema.parse({ name: 'a'.repeat(101), org_type: 'family' })
    ).toThrow()
  })

  it('accepts name at exactly 100 characters', () => {
    expect(() =>
      createOrgSchema.parse({ name: 'a'.repeat(100), org_type: 'family' })
    ).not.toThrow()
  })

  it('rejects invalid org_type', () => {
    expect(() =>
      createOrgSchema.parse({ name: 'Test Org', org_type: 'nonprofit' })
    ).toThrow()
  })

  it('rejects missing org_type', () => {
    expect(() =>
      createOrgSchema.parse({ name: 'Test Org' })
    ).toThrow()
  })
})

describe('updateOrgSchema', () => {
  it('accepts partial update with only name', () => {
    expect(() =>
      updateOrgSchema.parse({ name: 'New Name' })
    ).not.toThrow()
  })

  it('accepts partial update with only org_type', () => {
    expect(() =>
      updateOrgSchema.parse({ org_type: 'agency' })
    ).not.toThrow()
  })

  it('accepts empty object (no fields required)', () => {
    expect(() => updateOrgSchema.parse({})).not.toThrow()
  })

  it('still rejects invalid org_type when provided', () => {
    expect(() =>
      updateOrgSchema.parse({ org_type: 'nonprofit' })
    ).toThrow()
  })
})
