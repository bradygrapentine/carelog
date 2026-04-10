import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSendPush } = vi.hoisted(() => ({
  mockSendPush: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../pushNotification', () => ({
  sendPushToOrgCoordinators: mockSendPush,
}))

import { handleFlagAlert } from '../journalFlagAlert'

describe('handleFlagAlert', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls sendPushToOrgCoordinators with correct args', async () => {
    await handleFlagAlert({ orgId: 'org-1', eventId: 'evt-1', recipientId: 'rec-1' })
    expect(mockSendPush).toHaveBeenCalledWith('org-1', {
      title: 'Entry flagged for doctor',
      body: 'A journal entry has been flagged — tap to review.',
      data: { eventId: 'evt-1', screen: 'journal' },
    })
  })

  it('does not call sendPush when orgId is empty', async () => {
    await handleFlagAlert({ orgId: '', eventId: 'evt-1', recipientId: 'rec-1' })
    expect(mockSendPush).not.toHaveBeenCalled()
  })
})
