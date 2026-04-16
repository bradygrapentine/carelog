// apps/web/server/routers/careEventComments.ts
import { router, protectedProcedure } from "../trpc/index";
import {
  listCommentsInputSchema,
  addCommentInputSchema,
  editCommentInputSchema,
  removeCommentInputSchema,
} from "@carelog/schemas";
import {
  listComments,
  insertComment,
  editComment,
  softDeleteComment,
  getEventOrgId,
} from "../repositories/careEventCommentsRepository";
import { inngest } from "../../inngest/client";

export const careEventCommentsRouter = router({
  list: protectedProcedure
    .input(listCommentsInputSchema)
    .query(({ ctx, input }) => listComments(ctx.supabase, input.careEventId)),

  add: protectedProcedure
    .input(addCommentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = await getEventOrgId(input.careEventId);
      const result = await insertComment(ctx.supabase, {
        careEventId: input.careEventId,
        orgId,
        authorId: ctx.user.id,
        body: input.body,
      });
      await inngest
        .send({
          name: "careEventComment/created",
          data: {
            commentId: result.id,
            careEventId: input.careEventId,
            orgId,
            authorId: ctx.user.id,
          },
        })
        .catch(() => {});
      return result;
    }),

  edit: protectedProcedure
    .input(editCommentInputSchema)
    .mutation(({ ctx, input }) =>
      editComment(ctx.supabase, input.commentId, input.body),
    ),

  remove: protectedProcedure
    .input(removeCommentInputSchema)
    .mutation(async ({ ctx, input }) => {
      await softDeleteComment(ctx.supabase, input.commentId);
      return { ok: true as const };
    }),
});
