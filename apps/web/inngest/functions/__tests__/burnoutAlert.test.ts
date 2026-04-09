// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { detectBurnoutRisk, type CheckInRow } from '../burnoutAlert'

const BASE: CheckInRow = {
  user_id:      'user-a',
  org_id:       '00000000-0000-0000-0000-000000000001',
  week_stamp:   '2026-W14',
  stress_score: 4,
}

describe('detectBurnoutRisk', () => {
  it('returns user_id when stress_score >= 4 for 2 consecutive weeks', () => {
    const checkins: CheckInRow[] = [
      { ...BASE, week_stamp: '2026-W13', stress_score: 4 },
      { ...BASE, week_stamp: '2026-W14', stress_score: 5 },
    ]
    expect(detectBurnoutRisk(checkins)).toContain('user-a')
  })

  it('does NOT flag user with only 1 high-stress week', () => {
    const checkins: CheckInRow[] = [
      { ...BASE, week_stamp: '2026-W13', stress_score: 2 },
      { ...BASE, week_stamp: '2026-W14', stress_score: 5 },
    ]
    expect(detectBurnoutRisk(checkins)).toHaveLength(0)
  })

  it('does NOT flag user with stress_score of exactly 3 (threshold is >= 4)', () => {
    const checkins: CheckInRow[] = [
      { ...BASE, week_stamp: '2026-W13', stress_score: 3 },
      { ...BASE, week_stamp: '2026-W14', stress_score: 3 },
    ]
    expect(detectBurnoutRisk(checkins)).toHaveLength(0)
  })

  it('resets streak when a low-stress week breaks the run', () => {
    const checkins: CheckInRow[] = [
      { ...BASE, week_stamp: '2026-W12', stress_score: 5 },
      { ...BASE, week_stamp: '2026-W13', stress_score: 2 }, // breaks streak
      { ...BASE, week_stamp: '2026-W14', stress_score: 5 },
    ]
    expect(detectBurnoutRisk(checkins)).toHaveLength(0)
  })

  it('handles multiple users independently', () => {
    const checkins: CheckInRow[] = [
      { ...BASE, user_id: 'user-a', week_stamp: '2026-W13', stress_score: 4 },
      { ...BASE, user_id: 'user-a', week_stamp: '2026-W14', stress_score: 4 },
      { ...BASE, user_id: 'user-b', week_stamp: '2026-W13', stress_score: 1 },
      { ...BASE, user_id: 'user-b', week_stamp: '2026-W14', stress_score: 5 },
    ]
    const result = detectBurnoutRisk(checkins)
    expect(result).toContain('user-a')
    expect(result).not.toContain('user-b')
  })

  it('returns empty array for empty input', () => {
    expect(detectBurnoutRisk([])).toHaveLength(0)
  })

  it('flags at streak of exactly 2 (boundary condition)', () => {
    const checkins: CheckInRow[] = [
      { ...BASE, week_stamp: '2026-W13', stress_score: 4 },
      { ...BASE, week_stamp: '2026-W14', stress_score: 4 },
    ]
    expect(detectBurnoutRisk(checkins)).toHaveLength(1)
  })
})
