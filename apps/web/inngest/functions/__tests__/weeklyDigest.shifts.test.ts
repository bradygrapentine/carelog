// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { digestHtml } from '../weeklyDigest'

const BASE_OPTS = {
  orgName:      'Test Family',
  entries:      [{ id: '1', occurred_at: new Date().toISOString(), flagged: false, payload: { text: 'Test', mood: 'good' } }],
  recipientId:  'rec-001',
  appUrl:       'http://localhost:3000',
  medDoseCount: 0,
}

describe('digestHtml — shifts section', () => {
  it('includes shift section when shifts exist', () => {
    const html = digestHtml({
      ...BASE_OPTS,
      shifts: [{
        start_at:      '2026-04-14T09:00:00Z',
        end_at:        '2026-04-14T17:00:00Z',
        assignee_name: 'Alice',
        status:        'scheduled',
      }],
    })
    expect(html).toContain("Here's who's helping this week")
    expect(html).toContain('Alice')
  })

  it('omits shift section when no shifts', () => {
    const html = digestHtml({
      ...BASE_OPTS,
      shifts: [],
    })
    expect(html).not.toContain("Here's who's helping this week")
  })
})
