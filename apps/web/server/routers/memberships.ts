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
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      if (!data.success) {
        if (data.error === "not_found") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invite not found or has expired",
          });
        }
        if (data.error === "email_mismatch") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This invite was sent to a different email address",
          });
        }
        if (data.error === "already_used") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This invite has already been used",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: data.error ?? "Unknown error",
        });
      }

      return { success: true };
    }),

  changeRole: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        membershipId: z.string().uuid(),
        role: z.enum(["coordinator", "caregiver", "supporter", "aide"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: caller, error: callerError } = await supabaseAdmin
        .from("memberships")
        .select("role, accepted_at")
        .eq("org_id", input.orgId)
        .eq("user_id", ctx.user.id)
        .single();

      if (
        callerError ||
        !caller ||
        caller.role !== "coordinator" ||
        !caller.accepted_at
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { data: target, error: targetError } = await supabaseAdmin
        .from("memberships")
        .select("id, user_id, org_id")
        .eq("id", input.membershipId)
        .single();

      if (targetError || !target) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (target.org_id !== input.orgId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (target.user_id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own role",
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from("memberships")
        .update({ role: input.role })
        .eq("id", input.membershipId);

      if (updateError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: updateError.message,
        });
      }

      return { updated: true };
    }),

  remove: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        membershipId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: caller, error: callerError } = await supabaseAdmin
        .from("memberships")
        .select("role, accepted_at")
        .eq("org_id", input.orgId)
        .eq("user_id", ctx.user.id)
        .single();

      if (
        callerError ||
        !caller ||
        caller.role !== "coordinator" ||
        !caller.accepted_at
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { data: target, error: targetError } = await supabaseAdmin
        .from("memberships")
        .select("id, user_id, role, org_id")
        .eq("id", input.membershipId)
        .single();

      if (targetError || !target) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (target.org_id !== input.orgId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (target.user_id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove yourself from the team",
        });
      }

      if (target.role === "coordinator") {
        const { count, error: countError } = await supabaseAdmin
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("org_id", input.orgId)
          .eq("role", "coordinator")
          .not("accepted_at", "is", null);

        if (countError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: countError.message,
          });
        }

        if ((count ?? 0) <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last coordinator",
          });
        }
      }

      const { error: deleteError } = await supabaseAdmin
        .from("memberships")
        .delete()
        .eq("id", input.membershipId);

      if (deleteError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: deleteError.message,
        });
      }

      return { removed: true };
    }),
});
