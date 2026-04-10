import { inngest } from '../client'
import { sendPushToOrgCoordinators } from '../pushNotification'

// Pure handler — exported for unit tests
export async function handleFlagAlert(data: {
  orgId: string
  eventId: string
  recipientId: string
}): Promise<void> {
  if (!data.orgId) return

  await sendPushToOrgCoordinators(data.orgId, {
    title: 'Entry flagged for doctor',
    body: 'A journal entry has been flagged — tap to review.',
    data: { eventId: data.eventId, screen: 'journal' },
  })
}

export const journalFlagAlert = inngest.createFunction(
  { id: 'journal-flag-alert' },
  { event: 'journal/flagged' },
  async ({ event }) => {
    await handleFlagAlert(event.data as { orgId: string; eventId: string; recipientId: string })
    return { sent: true }
  },
)
