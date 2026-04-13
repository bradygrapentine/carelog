import { z } from "zod";
import { inngest } from "../client";
import { sendPushToOrgCoordinators } from "../pushNotification";

// Validated at handler entry — defense-in-depth against forged/malformed events (R2-014)
export const journalFlaggedEventSchema = z
  .object({
    orgId: z.string().uuid(),
    eventId: z.string().uuid(),
    recipientId: z.string().uuid(),
  })
  .strict();

export type JournalFlaggedEvent = z.infer<typeof journalFlaggedEventSchema>;

// Pure handler — exported for unit tests
export async function handleFlagAlert(
  data: JournalFlaggedEvent,
): Promise<void> {
  if (!data.orgId) return;

  await sendPushToOrgCoordinators(data.orgId, {
    title: "Entry flagged for doctor",
    body: "A journal entry has been flagged — tap to review.",
    data: { eventId: data.eventId, screen: "journal" },
  });
}

export const journalFlagAlert = inngest.createFunction(
  { id: "journal-flag-alert" },
  { event: "journal/flagged" },
  async ({ event }) => {
    const data = journalFlaggedEventSchema.parse(event.data);
    await handleFlagAlert(data);
    return { sent: true };
  },
);
