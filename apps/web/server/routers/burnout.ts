import { z } from "zod";
import { router, protectedProcedure } from "../trpc/index";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin, wrapAdminError } from "../supabaseAdmin.server";
import { burnoutCheckInInput, burnoutListInput } from "@carelog/schemas";

export const burnoutRouter = router({
  checkIn: protectedProcedure
    .input(burnoutCheckInInput)
    .mutation(async ({ ctx, input }) => {
      if (input.user_id !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { error } = await supabaseAdmin
        .from("burnout_checkins")
        .upsert({ ...input }, { onConflict: "user_id,week_stamp" });
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: wrapAdminError(error).message,
          cause: error,
        });
      return { upserted: true };
    }),

  myHistory: protectedProcedure
    .input(burnoutListInput)
    .query(async ({ ctx, input }) => {
      const { data, error } = await supabaseAdmin
        .from("burnout_checkins")
        .select("*")
        .eq("org_id", input.org_id)
        .eq("user_id", ctx.user.id)
        .order("week_stamp", { ascending: false })
        .limit(12);
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: wrapAdminError(error).message,
          cause: error,
        });
      return data ?? [];
    }),

  orgSummary: protectedProcedure
    .input(z.object({ org_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Coordinator only
      const { data: membership } = await supabaseAdmin
        .from("memberships")
        .select("role")
        .eq("org_id", input.org_id)
        .eq("user_id", ctx.user.id)
        .not("accepted_at", "is", null)
        .single();
      if (!membership || membership.role !== "coordinator") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { data, error } = await supabaseAdmin
        .from("burnout_checkins")
        .select("week_stamp, sleep_score, stress_score, support_score")
        .eq("org_id", input.org_id)
        .order("week_stamp", { ascending: false })
        .limit(200);
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: wrapAdminError(error).message,
          cause: error,
        });
      // Aggregate in JS by week_stamp
      const byWeek = new Map<
        string,
        { sleep: number[]; stress: number[]; support: number[]; count: number }
      >();
      for (const row of data ?? []) {
        const existing = byWeek.get(row.week_stamp) ?? {
          sleep: [],
          stress: [],
          support: [],
          count: 0,
        };
        existing.sleep.push(row.sleep_score);
        existing.stress.push(row.stress_score);
        existing.support.push(row.support_score);
        existing.count++;
        byWeek.set(row.week_stamp, existing);
      }
      const avg = (arr: number[]) =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const MIN_GROUP = 3; // suppress weeks with < 3 check-ins to prevent score de-anonymization
      return Array.from(byWeek.entries())
        .filter(([, v]) => v.count >= MIN_GROUP)
        .slice(0, 8)
        .map(([week_stamp, v]) => ({
          week_stamp,
          avg_sleep: avg(v.sleep),
          avg_stress: avg(v.stress),
          avg_support: avg(v.support),
          count: v.count,
        }));
    }),
});
