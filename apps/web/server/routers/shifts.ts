import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";
import {
  shiftCreateInput,
  shiftUpdateInput,
  shiftListInput,
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

async function requireAssigneeInOrg(orgId: string, assigneeUserId: string) {
  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", assigneeUserId)
    .not("accepted_at", "is", null)
    .single();

  if (error || !data) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Assignee is not an accepted member of this org.",
    });
  }
}

// ─── router ──────────────────────────────────────────────────────────────────

export const shiftsRouter = router({
  list: protectedProcedure
    .input(shiftListInput)
    .query(async ({ ctx, input }) => {
      // ctx.supabase is RLS-scoped — filters to orgs the caller belongs to
      const { data, error } = await ctx.supabase
        .from("shifts")
        .select("*")
        .eq("org_id", input.org_id)
        .eq("recipient_id", input.recipient_id)
        .gte("start_at", input.from)
        .lte("end_at", input.to)
        .order("start_at", { ascending: true })
        .range(input.cursor ?? 0, (input.cursor ?? 0) + input.limit - 1);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data ?? [];
    }),

  create: protectedProcedure
    .input(shiftCreateInput)
    .mutation(async ({ ctx, input }) => {
      await requireCoordinator(input.org_id, ctx.user.id);
      await requireAssigneeInOrg(input.org_id, input.assignee_user_id);

      const { recurrence, ...baseFields } = input;

      if (recurrence) {
        // Recurring: bulk-insert N weekly shifts. Skip application-layer overlap
        // check — the DB GiST exclusion constraint (shifts_no_overlap) is the
        // authoritative guard for the entire series.
        const seriesId = crypto.randomUUID();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const rows = Array.from({ length: recurrence.weeks }, (_, i) => ({
          org_id: input.org_id,
          recipient_id: input.recipient_id,
          assignee_user_id: input.assignee_user_id,
          start_at: new Date(
            new Date(input.start_at).getTime() + i * weekMs,
          ).toISOString(),
          end_at: new Date(
            new Date(input.end_at).getTime() + i * weekMs,
          ).toISOString(),
          notes: input.notes,
          status: "scheduled",
          created_by: ctx.user.id,
          recurring: true,
          recurrence: {
            freq: "weekly",
            weeks: recurrence.weeks,
            series_id: seriesId,
          },
        }));

        const { data, error } = await supabaseAdmin
          .from("shifts")
          .insert(rows)
          .select();
        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }
        return data;
      }

      // Single shift: application-layer overlap check for friendly error message.
      const { data: overlaps, error: overlapError } = await supabaseAdmin
        .from("shifts")
        .select("id")
        .eq("org_id", input.org_id)
        .eq("assignee_user_id", input.assignee_user_id)
        .neq("status", "cancelled")
        .lt("start_at", input.end_at)
        .gt("end_at", input.start_at)
        .limit(1);

      if (overlapError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: overlapError.message,
        });
      }

      if (overlaps && overlaps.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This assignee already has a shift overlapping that time.",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("shifts")
        .insert({
          org_id: baseFields.org_id,
          recipient_id: baseFields.recipient_id,
          assignee_user_id: baseFields.assignee_user_id,
          start_at: baseFields.start_at,
          end_at: baseFields.end_at,
          notes: baseFields.notes,
          status: "scheduled",
          created_by: ctx.user.id,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data;
    }),

  update: protectedProcedure
    .input(shiftUpdateInput)
    .mutation(async ({ ctx, input }) => {
      await requireCoordinator(input.org_id, ctx.user.id);

      // org_id is excluded from the DB write — it's only used for the auth
      // check above. Explicit exclusion prevents accidental org re-assignment.
      const { id, org_id: _org_id, ...fields } = input;

      const { data, error } = await supabaseAdmin
        .from("shifts")
        .update(fields)
        .eq("id", id)
        .eq("org_id", input.org_id) // C-1 fix: scope write to the caller's org
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data;
    }),

  complete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        org_id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Allow the assignee or coordinator to complete a shift
      const { data: shift, error: fetchError } = await supabaseAdmin
        .from("shifts")
        .select("assignee_user_id, status")
        .eq("id", input.id)
        .eq("org_id", input.org_id)
        .single();

      if (fetchError || !shift) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (shift.status === "cancelled" || shift.status === "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Shift is already cancelled or completed.",
        });
      }

      // Check if caller is the assignee
      const isAssignee = shift.assignee_user_id === ctx.user.id;

      if (!isAssignee) {
        // Fall back to coordinator check
        await requireCoordinator(input.org_id, ctx.user.id);
      }

      const { data, error } = await supabaseAdmin
        .from("shifts")
        .update({ status: "completed" })
        .eq("id", input.id)
        .eq("org_id", input.org_id)
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data;
    }),

  cancel: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        org_id: z.string().uuid(),
        cancel_future: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireCoordinator(input.org_id, ctx.user.id);

      if (input.cancel_future) {
        // Fetch the target shift to get series_id and start_at
        const { data: target, error: fetchError } = await supabaseAdmin
          .from("shifts")
          .select("start_at, recurrence")
          .eq("id", input.id)
          .eq("org_id", input.org_id)
          .single();

        if (fetchError || !target) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        const seriesId = (target.recurrence as { series_id?: string } | null)
          ?.series_id;
        if (!seriesId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Shift is not part of a series.",
          });
        }

        const { error } = await supabaseAdmin
          .from("shifts")
          .update({ status: "cancelled" })
          .eq("org_id", input.org_id)
          .filter("recurrence->>series_id", "eq", seriesId)
          .gte("start_at", target.start_at);

        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }

        return { cancelled: "series" };
      }

      const { data, error } = await supabaseAdmin
        .from("shifts")
        .update({ status: "cancelled" })
        .eq("id", input.id)
        .eq("org_id", input.org_id) // C-1 fix: scope write to the caller's org
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data;
    }),
});
