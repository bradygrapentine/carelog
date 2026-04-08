import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";
import {
  getMemberships,
  createMembershipAndInvite,
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
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from("memberships")
        .select("role, accepted_at")
        .eq("org_id", input.orgId)
        .eq("user_id", ctx.user.id)
        .single();

      if (
        membershipError ||
        !membership ||
        membership.role !== "coordinator" ||
        !membership.accepted_at
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { membershipId, token } = await createMembershipAndInvite({
        orgId: input.orgId,
        recipientId: input.recipientId,
        role: input.role,
        email: input.email,
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
      const { data, error } = await supabaseAdmin.rpc("accept_invite", {
        p_token: input.token,
        p_user_id: ctx.user.id,
        p_email: ctx.user.email?.toLowerCase().trim() ?? "",
      });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      if (!data.success) {
        if (data.error === "not_found") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Invite not found or has expired" });
        }
        if (data.error === "email_mismatch") {
          throw new TRPCError({ code: "FORBIDDEN", message: "This invite was sent to a different email address" });
        }
        if (data.error === "already_used") {
          throw new TRPCError({ code: "CONFLICT", message: "This invite has already been used" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: data.error ?? "Unknown error" });
      }

      return { success: true };
    }),
});
