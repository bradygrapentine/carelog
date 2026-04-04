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

describe('shift payload', () => {
  it('accepts valid shift log', () => {
    const result = validatePayload('shift', {
      shift_id: '18dc6d19-6712-4b26-8797-b4e544e01b84',
      action: 'completed',
    })
    expect(result.action).toBe('completed')
  })

  it('accepts all valid action values', () => {
    for (const action of ['started', 'completed', 'missed', 'covered'] as const) {
      expect(() =>
        validatePayload('shift', {
          shift_id: '18dc6d19-6712-4b26-8797-b4e544e01b84',
          action,
        })
      ).not.toThrow()
    }
  })

  it('rejects invalid action', () => {
    expect(() =>
      validatePayload('shift', {
        shift_id: '18dc6d19-6712-4b26-8797-b4e544e01b84',
        action: 'abandoned',
      })
    ).toThrow()
  })

  it('rejects non-uuid shift_id', () => {
    expect(() =>
      validatePayload('shift', { shift_id: 'not-a-uuid', action: 'started' })
    ).toThrow()
  })
})

describe('appointment payload', () => {
  it('accepts valid appointment with only required fields', () => {
    const result = validatePayload('appointment', { title: 'Cardiology checkup' })
    expect(result.title).toBe('Cardiology checkup')
  })

  it('accepts appointment with all optional fields', () => {
    expect(() =>
      validatePayload('appointment', {
        title: 'Cardiology checkup',
        provider: 'Dr. Smith',
        location: 'Main St Clinic',
        transport_by: '18dc6d19-6712-4b26-8797-b4e544e01b84',
        prep_notes: 'Fast for 8 hours',
        outcome_notes: 'All clear',
      })
    ).not.toThrow()
  })

  it('rejects invalid transport_by uuid', () => {
    expect(() =>
      validatePayload('appointment', {
        title: 'Checkup',
        transport_by: 'not-a-uuid',
      })
    ).toThrow()
  })
})

describe('symptom payload', () => {
  it('accepts empty symptom log (all fields optional)', () => {
    expect(() => validatePayload('symptom', {})).not.toThrow()
  })

  it('accepts valid symptom log with all fields', () => {
    const result = validatePayload('symptom', {
      pain_level: 3,
      mood_score: 7,
      appetite: 'good',
      mobility: 'normal',
      notes: 'Seemed comfortable',
      vitals: { blood_pressure: '120/80', heart_rate: 72, temperature: 98.6 },
    })
    expect(result.pain_level).toBe(3)
    expect(result.vitals?.heart_rate).toBe(72)
  })

  it('rejects pain_level above 10', () => {
    expect(() => validatePayload('symptom', { pain_level: 11 })).toThrow()
  })

  it('rejects pain_level below 0', () => {
    expect(() => validatePayload('symptom', { pain_level: -1 })).toThrow()
  })

  it('rejects invalid appetite value', () => {
    expect(() => validatePayload('symptom', { appetite: 'excellent' })).toThrow()
  })
})

describe('task payload', () => {
  it('accepts valid task', () => {
    const result = validatePayload('task', {
      title: 'Administer eye drops',
      completed_by: '18dc6d19-6712-4b26-8797-b4e544e01b84',
    })
    expect(result.title).toBe('Administer eye drops')
  })

  it('rejects missing completed_by', () => {
    expect(() =>
      validatePayload('task', { title: 'Administer eye drops' })
    ).toThrow()
  })

  it('rejects invalid completed_by uuid', () => {
    expect(() =>
      validatePayload('task', { title: 'Task', completed_by: 'not-a-uuid' })
    ).toThrow()
  })
})

describe('handoff payload', () => {
  it('accepts valid handoff', () => {
    const result = validatePayload('handoff', {
      shift_id: '18dc6d19-6712-4b26-8797-b4e544e01b84',
      outgoing_aide: '18dc6d19-6712-4b26-8797-b4e544e01b84',
      notes: 'Patient ate well, took all medications.',
    })
    expect(result.flags).toEqual([])
  })

  it('accepts handoff with flags', () => {
    const result = validatePayload('handoff', {
      shift_id: '18dc6d19-6712-4b26-8797-b4e544e01b84',
      outgoing_aide: '18dc6d19-6712-4b26-8797-b4e544e01b84',
      notes: 'Fell once.',
      flags: ['fall risk', 'pain elevated'],
    })
    expect(result.flags).toHaveLength(2)
  })

  it('rejects empty notes', () => {
    expect(() =>
      validatePayload('handoff', {
        shift_id: '18dc6d19-6712-4b26-8797-b4e544e01b84',
        outgoing_aide: '18dc6d19-6712-4b26-8797-b4e544e01b84',
        notes: '',
      })
    ).toThrow()
  })

  it('rejects missing outgoing_aide', () => {
    expect(() =>
      validatePayload('handoff', {
        shift_id: '18dc6d19-6712-4b26-8797-b4e544e01b84',
        notes: 'All good.',
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