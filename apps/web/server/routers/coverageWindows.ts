import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";
import { coverageWindowCreateInput, coverageWindowListInput } from "@carelog/schemas";

// ─── helpers ─────────────────────────────────────────────────────────────────

// Converts HH:MM + day_of_week to a reference epoch timestamptz.
// 1970-01-04 was a Sunday (day 0), so dayOfWeek 0-6 maps to 1970-01-04 through 1970-01-10.
// The gap detector uses day_of_week for filtering and extracts the time portion for comparison.
function timeToRefTimestamp(dayOfWeek: number, timeStr: string): string {
  // Start from Sunday 1970-01-04, add dayOfWeek days
  const base = new Date('1970-01-04T' + timeStr + ':00Z')
  base.setUTCDate(base.getUTCDate() + dayOfWeek)
  return base.toISOString()
}

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

export const coverageWindowsRouter = router({
  list: protectedProcedure
    .input(coverageWindowListInput)
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("coverage_windows")
        .select("*")
        .eq("org_id", input.org_id)
        .eq("recipient_id", input.recipient_id)
        .eq("recurring", true)
        .order("day_of_week", { ascending: true })
        .order("starts_at", { ascending: true });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data ?? [];
    }),

  create: protectedProcedure
    .input(coverageWindowCreateInput)
    .mutation(async ({ ctx, input }) => {
      await requireCoordinator(input.org_id, ctx.user.id);

      const { data, error } = await supabaseAdmin
        .from("coverage_windows")
        .insert({
          org_id:        input.org_id,
          recipient_id:  input.recipient_id,
          label:         input.label,
          // Convert HH:MM time strings to reference epoch timestamps so the
          // timestamptz NOT NULL constraint is satisfied. The gap detector uses
          // day_of_week + the UTC time portion of these timestamps for comparison.
          starts_at:     timeToRefTimestamp(input.day_of_week, input.starts_at),
          ends_at:       timeToRefTimestamp(input.day_of_week, input.ends_at),
          required_role: input.required_role,
          day_of_week:   input.day_of_week,
          recurring:     true,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid(), org_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireCoordinator(input.org_id, ctx.user.id);

      const { error } = await supabaseAdmin
        .from("coverage_windows")
        .delete()
        .eq("id", input.id)
        .eq("org_id", input.org_id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),
});
