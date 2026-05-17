import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as Sentry from "@sentry/nextjs";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin, wrapAdminError } from "../supabaseAdmin.server";
import {
  getMemberships,
  createMembershipAndInvite,
} from "../repositories/membershipsRepository";
import { getPostHogClient } from "@/lib/posthog-server";

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

      void (async () => {
        try {
          const { count: teamSize } = await supabaseAdmin
            .from("memberships")
            .select("id", { count: "exact", head: true })
            .eq("org_id", input.orgId)
            .not("accepted_at", "is", null);
          const posthog = getPostHogClient();
          posthog.capture({
            distinctId: ctx.user.id,
            event: "team_member_invited",
            properties: {
              org_id: input.orgId,
              role: input.role,
              team_size: (teamSize ?? 0) + 1,
            },
          });
        } catch {
          // analytics are non-critical — swallow errors silently
        }
      })();

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
        // TD-167: never echo raw Postgres / wrapAdminError strings as the
        // TRPCError message — that field reaches the client. Keep the rich
        // diagnostic in `cause` (server-only per trpc/index.ts errorFormatter)
        // and surface it to Sentry, return a generic client-facing message.
        Sentry.captureException(wrapAdminError(error), {
          tags: { component: "memberships.accept", path: "rpc.error" },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to accept invite",
          cause: error,
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
        // TD-167: unknown sentinel — log server-side, return generic.
        Sentry.captureException(
          new Error(`Unknown invite sentinel: ${data.error ?? "(empty)"}`),
          {
            tags: {
              component: "memberships.accept",
              path: "rpc.fallthrough",
            },
          },
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to accept invite",
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
        // TD-168: mirror TD-167 — never echo raw Postgres error strings to the
        // client. Keep diagnostic in `cause` (server-only per errorFormatter)
        // and surface to Sentry; return a generic client-facing message.
        Sentry.captureException(wrapAdminError(updateError), {
          tags: { component: "memberships.changeRole", path: "update.error" },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to change role",
          cause: updateError,
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
          // TD-168: generic client message; raw error to Sentry only.
          Sentry.captureException(wrapAdminError(countError), {
            tags: { component: "memberships.remove", path: "count.error" },
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to remove member",
            cause: countError,
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
        // TD-168: generic client message; raw error to Sentry only.
        Sentry.captureException(wrapAdminError(deleteError), {
          tags: { component: "memberships.remove", path: "delete.error" },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to remove member",
          cause: deleteError,
        });
      }

      return { removed: true };
    }),
});
