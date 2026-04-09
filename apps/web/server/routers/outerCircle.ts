import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";
import {
  outerCircleRequestCreateInput,
  outerCircleDeactivateInput,
  outerCircleListInput,
} from "@carelog/schemas";

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

export const outerCircleRouter = router({
  list: protectedProcedure
    .input(outerCircleListInput)
    .query(async ({ ctx, input }) => {
      // Use RLS-scoped ctx.supabase so only org members can list
      const { data, error } = await ctx.supabase
        .from("outer_circle_requests")
        .select("id, title, description, request_type, slots_total, slots_filled, needed_by, active, share_token, created_at")
        .eq("org_id", input.org_id)
        .eq("recipient_id", input.recipient_id)
        .order("created_at", { ascending: false });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data ?? [];
    }),

  create: protectedProcedure
    .input(outerCircleRequestCreateInput)
    .mutation(async ({ ctx, input }) => {
      await requireCoordinator(input.org_id, ctx.user.id);

      const { data, error } = await supabaseAdmin
        .from("outer_circle_requests")
        .insert({
          org_id:       input.org_id,
          recipient_id: input.recipient_id,
          title:        input.title,
          description:  input.description,
          request_type: input.request_type,
          slots_total:  input.slots_total,
          needed_by:    input.needed_by,
          created_by:   ctx.user.id,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),

  deactivate: protectedProcedure
    .input(outerCircleDeactivateInput)
    .mutation(async ({ ctx, input }) => {
      await requireCoordinator(input.org_id, ctx.user.id);

      const { data, error } = await supabaseAdmin
        .from("outer_circle_requests")
        .update({ active: false })
        .eq("id", input.id)
        .eq("org_id", input.org_id)
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),
});
