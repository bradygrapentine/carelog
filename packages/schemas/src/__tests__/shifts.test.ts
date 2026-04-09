import { describe, it, expect } from 'vitest'
import { shiftCreateInput, shiftUpdateInput, shiftListInput } from '../shifts'

const VALID_UUID = '18dc6d19-6712-4b26-8797-b4e544e01b84'
const PAST       = '2026-04-08T08:00:00.000Z'
const FUTURE     = '2026-04-08T16:00:00.000Z'

describe('shiftCreateInput', () => {
  const base = {
    org_id:           VALID_UUID,
    recipient_id:     VALID_UUID,
    assignee_user_id: VALID_UUID,
    start_at:         PAST,
    end_at:           FUTURE,
  }

  it('accepts a valid shift', () => {
    expect(() => shiftCreateInput.parse(base)).not.toThrow()
  })

  it('rejects when end_at equals start_at', () => {
    expect(() => shiftCreateInput.parse({ ...base, end_at: PAST })).toThrow()
  })

  it('rejects when end_at is before start_at', () => {
    expect(() => shiftCreateInput.parse({ ...base, start_at: FUTURE, end_at: PAST })).toThrow()
  })

  it('rejects non-uuid org_id', () => {
    expect(() => shiftCreateInput.parse({ ...base, org_id: 'not-a-uuid' })).toThrow()
  })

  it('rejects non-uuid recipient_id', () => {
    expect(() => shiftCreateInput.parse({ ...base, recipient_id: 'not-a-uuid' })).toThrow()
  })

  it('rejects non-uuid assignee_user_id', () => {
    expect(() => shiftCreateInput.parse({ ...base, assignee_user_id: 'not-a-uuid' })).toThrow()
  })

  it('rejects notes over 2000 characters', () => {
    expect(() => shiftCreateInput.parse({ ...base, notes: 'a'.repeat(2001) })).toThrow()
  })

  it('accepts optional notes within limit', () => {
    expect(() => shiftCreateInput.parse({ ...base, notes: 'short note' })).not.toThrow()
  })
})

describe('shiftUpdateInput', () => {
  it('accepts a valid status update', () => {
    expect(() => shiftUpdateInput.parse({ id: VALID_UUID, org_id: VALID_UUID, status: 'completed' })).not.toThrow()
  })

  it('rejects unknown status values', () => {
    expect(() => shiftUpdateInput.parse({ id: VALID_UUID, org_id: VALID_UUID, status: 'pending' })).toThrow()
  })

  it('rejects non-uuid id', () => {
    expect(() => shiftUpdateInput.parse({ id: 'bad', org_id: VALID_UUID })).toThrow()
  })

  it('does not allow updating recipient_id or org_id independently', () => {
    // org_id is required for auth check — recipient_id must not be updatable
    const result = shiftUpdateInput.safeParse({ id: VALID_UUID, org_id: VALID_UUID, recipient_id: VALID_UUID })
    expect(result.success).toBe(false)
  })
})

describe('shiftListInput', () => {
  const base = {
    org_id:       VALID_UUID,
    recipient_id: VALID_UUID,
    from:         PAST,
    to:           FUTURE,
  }

  it('accepts valid list input', () => {
    expect(() => shiftListInput.parse(base)).not.toThrow()
  })

  it('rejects missing recipient_id', () => {
    const { recipient_id: _, ...rest } = base
    expect(() => shiftListInput.parse(rest)).toThrow()
  })

  it('defaults limit to 50 when not provided', () => {
    const parsed = shiftListInput.parse(base)
    expect(parsed.limit).toBe(50)
  })
})
