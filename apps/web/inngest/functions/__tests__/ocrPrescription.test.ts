// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseOcrText } from '../ocrPrescription'

describe('parseOcrText', () => {
  it('extracts drug name from the first line', () => {
    const result = parseOcrText('Lisinopril 10mg\nTake once daily with water')
    expect(result.drug_name).toBe('Lisinopril')
  })

  it('extracts dosage in mg', () => {
    const result = parseOcrText('Lisinopril 10mg\nTake once daily with water')
    expect(result.dosage).toBe('10mg')
  })

  it('extracts instructions containing "take"', () => {
    const result = parseOcrText('Lisinopril 10mg\nTake once daily with water')
    expect(result.instructions).toMatch(/take once daily with water/i)
  })

  it('handles mcg dosage units', () => {
    const result = parseOcrText('Levothyroxine 50 mcg\nTake with water')
    expect(result.dosage).toBe('50 mcg')
  })

  it('returns null dosage when no dosage found', () => {
    const result = parseOcrText('Aspirin\nTake daily')
    expect(result.dosage).toBeNull()
  })

  it('returns null instructions when no instruction keywords found', () => {
    const result = parseOcrText('Aspirin 81mg\nFor pain relief')
    expect(result.instructions).toBeNull()
  })

  it('returns Unknown for empty first line', () => {
    const result = parseOcrText('')
    expect(result.drug_name).toBe('Unknown')
  })

  it('strips dosage from drug_name', () => {
    const result = parseOcrText('Metformin 500mg\nTake twice daily with food')
    expect(result.drug_name).not.toContain('500mg')
    expect(result.drug_name).toBe('Metformin')
  })

  it('matches "daily" instruction pattern', () => {
    const result = parseOcrText('Atorvastatin 20mg\nTake daily at bedtime')
    expect(result.instructions).toMatch(/daily/i)
  })

  it('matches "with food" instruction pattern', () => {
    const result = parseOcrText('Metformin 500mg\nTake with food to avoid upset stomach')
    expect(result.instructions).toMatch(/with food/i)
  })
})
