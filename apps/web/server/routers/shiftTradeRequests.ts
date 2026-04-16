import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";
import {
  createTradeRequestInput,
  respondTradeRequestInput,
  forceOverrideTradeInput,
  listTradeRequestsInput,
} from "@carelog/schemas";
import {
  createRequest,
  respondToRequest,
  acceptRequest,
  forceOverride,
  listForShift,
} from "../repositories/shiftTradeRequestsRepository";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function requireCoordinator(orgId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("role, accepted_at")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single();

  if (error || !data || data.role !== "coordinator" || !data.accepted_at) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

// ─── router ──────────────────────────────────────────────────────────────────

export const shiftTradeRequestsRouter = router({
  create: protectedProcedure
    .input(createTradeRequestInput)
    .mutation(async ({ ctx, input }) => {
      // Fetch the shift to get org_id and verify the caller is the assignee
      const { data: shift, error: shiftError } = await supabaseAdmin
        .from("shifts")
        .select("id, org_id, assignee_user_id")
        .eq("id", input.shiftId)
        .single();

      if (shiftError || !shift) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shift not found." });
      }

      if (shift.assignee_user_id !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the shift assignee can request a trade.",
        });
      }

      return createRequest(ctx.supabase, {
        shiftId: input.shiftId,
        orgId: shift.org_id,
        requestedBy: ctx.user.id,
        targetUserId: input.targetUserId,
        message: input.message,
      });
    }),

  respond: protectedProcedure
    .input(respondTradeRequestInput)
    .mutation(async ({ ctx, input }) => {
      if (input.action === "accept") {
        // Atomic path: updates trade status + reassigns shift in one service-role op
        return acceptRequest(input.requestId, ctx.user.id);
      }
      // Decline: RLS-scoped write via user's supabase client
      return respondToRequest(
        ctx.supabase,
        input.requestId,
        ctx.user.id,
        "decline",
      );
    }),

  forceOverride: protectedProcedure
    .input(forceOverrideTradeInput.extend({ orgId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireCoordinator(input.orgId, ctx.user.id);
      return forceOverride(
        input.requestId,
        ctx.user.id,
        input.orgId,
        input.action,
      );
    }),

  list: protectedProcedure
    .input(listTradeRequestsInput)
    .query(async ({ ctx, input }) => {
      return listForShift(ctx.supabase, input.shiftId ?? "", input.status);
    }),
});
