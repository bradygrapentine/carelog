import { formatEntryTime, formatEntryDateTime, canFlag, MOOD_COLORS, REACTIONS } from '../utils/journalUtils'

describe('formatEntryTime', () => {
  it('returns a time string matching HH:MM format', () => {
    const result = formatEntryTime('2026-04-10T14:30:00.000Z')
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })
})

describe('formatEntryDateTime', () => {
  it('includes "at" separator between date and time', () => {
    const result = formatEntryDateTime('2026-04-10T14:30:00.000Z')
    expect(result).toContain(' at ')
  })

  it('is longer than 10 characters', () => {
    const result = formatEntryDateTime('2026-04-10T14:30:00.000Z')
    expect(result.length).toBeGreaterThan(10)
  })
})

describe('canFlag', () => {
  it('returns true for coordinator', () => {
    expect(canFlag('coordinator')).toBe(true)
  })

  it('returns false for caregiver', () => {
    expect(canFlag('caregiver')).toBe(false)
  })

  it('returns false for supporter', () => {
    expect(canFlag('supporter')).toBe(false)
  })

  it('returns false for aide', () => {
    expect(canFlag('aide')).toBe(false)
  })

  it('returns false for null', () => {
    expect(canFlag(null)).toBe(false)
  })
})

describe('MOOD_COLORS', () => {
  const moods = ['good', 'okay', 'difficult', 'crisis'] as const
  moods.forEach(mood => {
    it(`has bg and text color for "${mood}"`, () => {
      expect(MOOD_COLORS[mood].bg).toBeTruthy()
      expect(MOOD_COLORS[mood].text).toBeTruthy()
    })
  })
})

describe('REACTIONS', () => {
  it('has exactly 4 reactions', () => {
    expect(REACTIONS).toHaveLength(4)
  })

  it('contains heart, thinking_of_you, strong, grateful keys', () => {
    const keys = REACTIONS.map(r => r.key)
    expect(keys).toContain('heart')
    expect(keys).toContain('thinking_of_you')
    expect(keys).toContain('strong')
    expect(keys).toContain('grateful')
  })
})
