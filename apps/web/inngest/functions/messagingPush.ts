// apps/web/inngest/functions/messagingPush.ts
import { inngest } from "../client";
import { sendExpoPush, getPushTokensForUsers } from "../pushNotification";
import { getThreadMembersForPush } from "../../server/repositories/messagesRepository";

const PUSH_DELAY = "5 minutes";

export const messagingPushFn = inngest.createFunction(
  {
    id: "messaging-delayed-push",
    name: "Messaging: delayed push notification",
  },
  { event: "messaging/message.sent" },
  async ({ event, step }) => {
    const { threadId, senderId, sentAt } = event.data as {
      threadId: string;
      messageId: string;
      senderId: string;
      sentAt: string;
    };

    // Wait 5 minutes before deciding to push
    await step.sleep("wait-before-push", PUSH_DELAY);

    const members = await step.run("get-thread-members", () =>
      getThreadMembersForPush(threadId),
    );

    // Verify senderId is actually a member of this thread
    const senderMembership = members.find((m) => m.user_id === senderId);
    if (!senderMembership) {
      // Event forged or sender was removed from thread — abort silently
      return { pushed: 0, aborted: true, reason: "sender_not_member" };
    }

    // Push to members who haven't read the thread since the message was sent
    const sentAtDate = new Date(sentAt);
    const recipientIds = members
      .filter((m) => {
        if (m.user_id === senderId) return false; // don't push sender
        if (!m.last_read_at) return true; // never read → push
        return new Date(m.last_read_at) < sentAtDate; // unread → push
      })
      .map((m) => m.user_id);

    if (recipientIds.length === 0) return { pushed: 0 };

    await step.run("send-push", async () => {
      const tokens = await getPushTokensForUsers(recipientIds);
      if (tokens.length === 0) return;

      await sendExpoPush(
        tokens.map((token) => ({
          to: token,
          title: "New message",
          body: "You have an unread message",
          sound: "default" as const,
          data: { threadId },
        })),
      );
    });

    return { pushed: recipientIds.length };
  },
);
