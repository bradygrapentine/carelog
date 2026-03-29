import { describe, it, expect } from 'vitest'
import { validatePayload } from '../careEvents'

describe('journal payload', () => {
  it('accepts valid entry with mood', () => {
    const result = validatePayload('journal', {
      text: 'Dad was calm today.',
      mood: 'good',
    })
    expect(result.text).toBe('Dad was calm today.')
    expect(result.mood).toBe('good')
  })

  it('accepts valid entry without mood', () => {
    expect(() =>
      validatePayload('journal', { text: 'Good day' })
    ).not.toThrow()
  })

  it('rejects empty text', () => {
    expect(() =>
      validatePayload('journal', { text: '' })
    ).toThrow()
  })

  it('rejects invalid mood value', () => {
    expect(() =>
      validatePayload('journal', { text: 'Good day', mood: 'fantastic' })
    ).toThrow()
  })

  it('rejects missing text field', () => {
    expect(() =>
      validatePayload('journal', { mood: 'good' })
    ).toThrow()
  })
})

describe('medication payload', () => {
  it('accepts valid medication log', () => {
    const result = validatePayload('medication', {
      medication_id:   '18dc6d19-6712-4b26-8797-b4e544e01b84',
      given:           true,
      administered_by: '18dc6d19-6712-4b26-8797-b4e544e01b84',
    })
    expect(result.given).toBe(true)
  })

  it('rejects invalid medication_id (not uuid)', () => {
    expect(() =>
      validatePayload('medication', {
        medication_id:   'not-a-uuid',
        given:           true,
        administered_by: '18dc6d19-6712-4b26-8797-b4e544e01b84',
      })
    ).toThrow()
  })

  it('requires given field', () => {
    expect(() =>
      validatePayload('medication', {
        medication_id:   '18dc6d19-6712-4b26-8797-b4e544e01b84',
        administered_by: '18dc6d19-6712-4b26-8797-b4e544e01b84',
      })
    ).toThrow()
  })
})

describe('expense payload', () => {
  it('accepts valid expense', () => {
    const result = validatePayload('expense', {
      amount:   2500,
      category: 'medication',
      paid_by:  '18dc6d19-6712-4b26-8797-b4e544e01b84',
    })
    expect(result.amount).toBe(2500)
  })

  it('rejects negative amount', () => {
    expect(() =>
      validatePayload('expense', {
        amount:   -100,
        category: 'medication',
        paid_by:  '18dc6d19-6712-4b26-8797-b4e544e01b84',
      })
    ).toThrow()
  })

  it('rejects invalid category', () => {
    expect(() =>
      validatePayload('expense', {
        amount:   100,
        category: 'groceries',
        paid_by:  '18dc6d19-6712-4b26-8797-b4e544e01b84',
      })
    ).toThrow()
  })
})

describe('unknown event type', () => {
  it('throws for unknown event type', () => {
    expect(() =>
      validatePayload('unknown' as any, { text: 'test' })
    ).toThrow()
  })
})