import { describe, it, expect } from 'vitest'
import { exportRequestSchema } from '../export'

const VALID_UUID_A = '00000000-0000-0000-0000-000000000001'
const VALID_UUID_B = '00000000-0000-0000-0000-000000000002'

describe('exportRequestSchema', () => {
  const BASE = {
    orgId:       VALID_UUID_A,
    recipientId: VALID_UUID_B,
    format:      'json' as const,
  }

  it('accepts a minimal valid input (no since)', () => {
    const result = exportRequestSchema.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('accepts pdf format', () => {
    const result = exportRequestSchema.safeParse({ ...BASE, format: 'pdf' })
    expect(result.success).toBe(true)
  })

  it('accepts a valid since datetime with offset', () => {
    const result = exportRequestSchema.safeParse({
      ...BASE,
      since: '2026-01-01T00:00:00+00:00',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a since datetime in UTC Z format', () => {
    const result = exportRequestSchema.safeParse({
      ...BASE,
      since: '2026-04-14T08:30:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid format value', () => {
    const result = exportRequestSchema.safeParse({ ...BASE, format: 'csv' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-UUID orgId', () => {
    const result = exportRequestSchema.safeParse({ ...BASE, orgId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-UUID recipientId', () => {
    const result = exportRequestSchema.safeParse({ ...BASE, recipientId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects a since value without timezone offset', () => {
    const result = exportRequestSchema.safeParse({ ...BASE, since: '2026-01-01T00:00:00' })
    expect(result.success).toBe(false)
  })

  it('rejects a since value that is just a date (not datetime)', () => {
    const result = exportRequestSchema.safeParse({ ...BASE, since: '2026-01-01' })
    expect(result.success).toBe(false)
  })

  it('rejects missing format', () => {
    const result = exportRequestSchema.safeParse({ orgId: VALID_UUID_A, recipientId: VALID_UUID_B })
    expect(result.success).toBe(false)
  })
})
