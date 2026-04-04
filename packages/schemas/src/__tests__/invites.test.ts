import { describe, it, expect } from 'vitest'
import { createInviteSchema, acceptInviteSchema } from '../invites'

const VALID_UUID = '18dc6d19-6712-4b26-8797-b4e544e01b84'

describe('createInviteSchema', () => {
  it('accepts a valid invite with all fields', () => {
    const result = createInviteSchema.parse({
      orgId:       VALID_UUID,
      recipientId: VALID_UUID,
      role:        'caregiver',
      email:       'caregiver@family.com',
    })
    expect(result.role).toBe('caregiver')
    expect(result.email).toBe('caregiver@family.com')
  })

  it('accepts a null recipientId (org-wide membership)', () => {
    expect(() =>
      createInviteSchema.parse({
        orgId:       VALID_UUID,
        recipientId: null,
        role:        'supporter',
        email:       'supporter@family.com',
      })
    ).not.toThrow()
  })

  it('accepts all valid roles', () => {
    const roles = ['coordinator', 'caregiver', 'supporter', 'aide'] as const
    for (const role of roles) {
      expect(() =>
        createInviteSchema.parse({ orgId: VALID_UUID, recipientId: null, role, email: 'x@y.com' })
      ).not.toThrow()
    }
  })

  it('rejects an invalid role', () => {
    expect(() =>
      createInviteSchema.parse({
        orgId:       VALID_UUID,
        recipientId: null,
        role:        'admin',
        email:       'x@y.com',
      })
    ).toThrow()
  })

  it('rejects a malformed email', () => {
    expect(() =>
      createInviteSchema.parse({
        orgId:       VALID_UUID,
        recipientId: null,
        role:        'caregiver',
        email:       'not-an-email',
      })
    ).toThrow()
  })

  it('rejects a non-UUID orgId', () => {
    expect(() =>
      createInviteSchema.parse({
        orgId:       'not-a-uuid',
        recipientId: null,
        role:        'caregiver',
        email:       'x@y.com',
      })
    ).toThrow()
  })

  it('rejects a non-UUID recipientId', () => {
    expect(() =>
      createInviteSchema.parse({
        orgId:       VALID_UUID,
        recipientId: 'not-a-uuid',
        role:        'caregiver',
        email:       'x@y.com',
      })
    ).toThrow()
  })

  it('rejects missing email', () => {
    expect(() =>
      createInviteSchema.parse({
        orgId:       VALID_UUID,
        recipientId: null,
        role:        'caregiver',
      })
    ).toThrow()
  })
})

describe('acceptInviteSchema', () => {
  it('accepts a valid 64-char hex token', () => {
    const token = 'a'.repeat(64)
    const result = acceptInviteSchema.parse({ token })
    expect(result.token).toBe(token)
  })

  it('rejects a token that is too short', () => {
    expect(() =>
      acceptInviteSchema.parse({ token: 'a'.repeat(63) })
    ).toThrow()
  })

  it('rejects a token that is too long', () => {
    expect(() =>
      acceptInviteSchema.parse({ token: 'a'.repeat(65) })
    ).toThrow()
  })

  it('rejects a missing token', () => {
    expect(() =>
      acceptInviteSchema.parse({})
    ).toThrow()
  })
})
