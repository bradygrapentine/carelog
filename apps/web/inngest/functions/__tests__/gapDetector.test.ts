// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { detectGaps } from '../gapDetector'
import type { CoverageWindow } from '../gapDetector'

// 2026-04-09 is a Thursday (day 4 UTC)
const THURSDAY = new Date('2026-04-09T08:00:00Z')

function makeWindow(overrides: Partial<CoverageWindow> = {}): CoverageWindow {
  return {
    id:            'win-001',
    org_id:        'org-001',
    recipient_id:  'rec-001',
    label:         'Morning care',
    // Reference timestamp for Thursday 09:00 UTC:
    // 1970-01-04 (Sunday) + 4 days = 1970-01-08 (Thursday) + 09:00
    starts_at:     '1970-01-08T09:00:00.000Z',
    ends_at:       '1970-01-08T17:00:00.000Z',
    day_of_week:   4, // Thursday
    required_role: 'caregiver',
    ...overrides,
  }
}

function makeShift(overrides: Record<string, string> = {}) {
  return {
    start_at:         '2026-04-09T09:00:00Z',
    end_at:           '2026-04-09T17:00:00Z',
    status:           'scheduled',
    assignee_user_id: 'user-001',
    ...overrides,
  }
}

describe('detectGaps', () => {
  it('returns empty array when all windows are covered', () => {
    const gaps = detectGaps([makeWindow()], [makeShift()], THURSDAY)
    expect(gaps).toHaveLength(0)
  })

  it('returns gap when no shifts exist', () => {
    const gaps = detectGaps([makeWindow()], [], THURSDAY)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].id).toBe('win-001')
  })

  it('ignores windows for other days of week', () => {
    const fridayWindow = makeWindow({ day_of_week: 5 }) // Friday
    const gaps = detectGaps([fridayWindow], [], THURSDAY)
    expect(gaps).toHaveLength(0)
  })

  it('ignores cancelled shifts when checking coverage', () => {
    const cancelledShift = makeShift({ status: 'cancelled' })
    const gaps = detectGaps([makeWindow()], [cancelledShift], THURSDAY)
    expect(gaps).toHaveLength(1)
  })

  it('partial overlap counts as covered', () => {
    // Shift covers only 09:00-13:00, window needs 09:00-17:00
    // But partial overlap means the window START is covered
    const partialShift = makeShift({ end_at: '2026-04-09T13:00:00Z' })
    const gaps = detectGaps([makeWindow()], [partialShift], THURSDAY)
    // A partial overlap still "covers" in this simple model
    expect(gaps).toHaveLength(0)
  })

  it('shift before window does not count as coverage', () => {
    const beforeShift = makeShift({
      start_at: '2026-04-09T05:00:00Z',
      end_at:   '2026-04-09T08:00:00Z',
    })
    const gaps = detectGaps([makeWindow()], [beforeShift], THURSDAY)
    expect(gaps).toHaveLength(1)
  })

  it('handles multiple windows, detects only uncovered ones', () => {
    const coveredWindow   = makeWindow({ id: 'win-covered' })
    const uncoveredWindow = makeWindow({ id: 'win-gap', starts_at: '1970-01-08T18:00:00.000Z', ends_at: '1970-01-08T22:00:00.000Z' })
    const gaps = detectGaps([coveredWindow, uncoveredWindow], [makeShift()], THURSDAY)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].id).toBe('win-gap')
  })
})
