import { z } from "zod";
import { router, protectedProcedure } from "../trpc/index";
import {
  getMemberships,
  createMembershipAndInvite,
  acceptInvite,
} from "../repositories/membershipsRepository";

export const membershipsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        recipientId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getMemberships(ctx.supabase, input.orgId, input.recipientId);
    }),

  invite: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        recipientId: z.string().uuid().nullable(),
        role: z.enum(["coordinator", "caregiver", "supporter", "aide"]),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { membershipId, token } = await createMembershipAndInvite({
        orgId: input.orgId,
        recipientId: input.recipientId,
        role: input.role,
        email: input.email,
        invitedBy: ctx.user.id,
      });

      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invite/${token}`;
      return { membershipId, inviteUrl };
    }),

  accept: protectedProcedure
    .input(
      z.object({
        token: z.string().min(64).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await acceptInvite(input.token, {
        id: ctx.user.id,
        email: ctx.user.email ?? "",
      });
      return { success: true };
    }),
});
