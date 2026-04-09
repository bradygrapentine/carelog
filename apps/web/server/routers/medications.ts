import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";
import { medicationCreateInput, medicationListInput, medicationUpdateInput } from "@carelog/schemas";

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

export const medicationsRouter = router({
  list: protectedProcedure
    .input(medicationListInput)
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("medications")
        .select("*")
        .eq("org_id", input.org_id)
        .eq("recipient_id", input.recipient_id)
        .eq("active", true)
        .order("drug_name", { ascending: true });

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data ?? [];
    }),

  create: protectedProcedure
    .input(medicationCreateInput)
    .mutation(async ({ ctx, input }) => {
      await requireCoordinator(input.org_id, ctx.user.id);

      const { data, error } = await supabaseAdmin
        .from("medications")
        .insert({
          org_id:                input.org_id,
          recipient_id:          input.recipient_id,
          drug_name:             input.drug_name,
          brand_name:            input.brand_name ?? null,
          dosage:                input.dosage,
          form:                  input.form ?? null,
          instructions:          input.instructions ?? null,
          prescriber:            input.prescriber ?? null,
          pharmacy:              input.pharmacy ?? null,
          pharmacy_phone:        input.pharmacy_phone ?? null,
          refills_remaining:     input.refills_remaining ?? null,
          supply_days_remaining: input.supply_days_remaining ?? null,
          last_refill_date:      input.last_refill_date ?? null,
          scan_source:           "manual",
          active:                true,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),

  update: protectedProcedure
    .input(medicationUpdateInput)
    .mutation(async ({ ctx, input }) => {
      await requireCoordinator(input.org_id, ctx.user.id);

      const { id, org_id: _org_id, ...fields } = input;

      const { data, error } = await supabaseAdmin
        .from("medications")
        .update(fields)
        .eq("id", id)
        .eq("org_id", input.org_id)
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

      // Soft delete — set active=false so refill alert history is preserved
      const { error } = await supabaseAdmin
        .from("medications")
        .update({ active: false })
        .eq("id", input.id)
        .eq("org_id", input.org_id);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  listScheduled: protectedProcedure
    .input(z.object({ org_id: z.string().uuid(), recipient_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const todayDow = new Date().getUTCDay();
      const { data, error } = await ctx.supabase
        .from("medication_schedules")
        .select("id, scheduled_time, medications(id, drug_name, dosage)")
        .eq("org_id", input.org_id)
        .eq("recipient_id", input.recipient_id)
        .contains("days_of_week", [todayDow]);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data ?? [];
    }),

  todayLog: protectedProcedure
    .input(z.object({ org_id: z.string().uuid(), recipient_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { data, error } = await ctx.supabase
        .from("care_events")
        .select("payload")
        .eq("org_id", input.org_id)
        .eq("recipient_id", input.recipient_id)
        .eq("event_type", "medication")
        .eq("entry_kind", "system")
        .gte("occurred_at", todayStart.toISOString());
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return (data ?? []).map(e => (e.payload as { medication_id: string; scheduled_time: string; action: string }));
    }),

  logAdministration: protectedProcedure
    .input(z.object({
      org_id:         z.string().uuid(),
      recipient_id:   z.string().uuid(),
      medication_id:  z.string().uuid(),
      scheduled_time: z.string(),
      action:         z.enum(["given", "missed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from("memberships")
        .select("role, accepted_at")
        .eq("org_id", input.org_id)
        .eq("user_id", ctx.user.id)
        .single();
      if (!membership || !membership.accepted_at || membership.role === "supporter") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { data, error } = await supabaseAdmin
        .from("care_events")
        .insert({
          org_id:       input.org_id,
          recipient_id: input.recipient_id,
          created_by:   ctx.user.id,
          event_type:   "medication",
          entry_kind:   "system",
          occurred_at:  new Date().toISOString(),
          payload: {
            medication_id:  input.medication_id,
            action:         input.action,
            scheduled_time: input.scheduled_time,
          },
        })
        .select()
        .single();
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),
});
