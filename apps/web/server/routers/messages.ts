// apps/web/server/routers/messages.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import {
  listThreadsForUser,
  getThreadMessages,
  getThreadMembers,
  findOrCreateDm,
  createGroupThread,
  insertMessage,
  markThreadRead,
} from "../repositories/messagesRepository";
import {
  sendMessageInputSchema,
  createDmInputSchema,
  createGroupInputSchema,
  markReadInputSchema,
} from "@carelog/schemas";
import { inngest } from "../../inngest/client";

export const messagesRouter = router({
  /** List all threads for current user in an org, with unread counts. */
  listThreads: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return listThreadsForUser(ctx.supabase, ctx.user.id, input.orgId);
    }),

  /** Get messages in a thread (newest 50, paginated via cursor). */
  getMessages: protectedProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        before: z.string().datetime().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getThreadMessages(ctx.supabase, input.threadId, 50, input.before);
    }),

  /** Get thread members. */
  getMembers: protectedProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getThreadMembers(ctx.supabase, input.threadId);
    }),

  /** Send a message to a thread. Triggers delayed push notification. */
  sendMessage: protectedProcedure
    .input(sendMessageInputSchema)
    .mutation(async ({ ctx, input }) => {
      const message = await insertMessage(
        ctx.supabase,
        input.threadId,
        ctx.user.id,
        input.body,
      );

      // Fire delayed push (5 min). Non-blocking — failure doesn't break the send.
      await inngest
        .send({
          name: "messaging/message.sent",
          data: {
            threadId: input.threadId,
            messageId: message.id,
            senderId: ctx.user.id,
            sentAt: message.created_at,
          },
        })
        .catch(() => {});

      return message;
    }),

  /** Find or create a DM thread between current user and target. */
  createDm: protectedProcedure
    .input(createDmInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.targetUserId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot DM yourself",
        });
      }
      const threadId = await findOrCreateDm(
        ctx.user.id,
        input.targetUserId,
        input.orgId,
      );
      return { threadId };
    }),

  /** Create a group thread. */
  createGroup: protectedProcedure
    .input(createGroupInputSchema)
    .mutation(async ({ ctx, input }) => {
      const threadId = await createGroupThread(
        ctx.user.id,
        input.orgId,
        input.name,
        input.memberUserIds,
      );
      return { threadId };
    }),

  /** Mark a thread as read (update last_read_at). */
  markRead: protectedProcedure
    .input(markReadInputSchema)
    .mutation(async ({ ctx, input }) => {
      await markThreadRead(ctx.supabase, input.threadId, ctx.user.id);
      return { ok: true };
    }),
});
