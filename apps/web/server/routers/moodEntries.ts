import { z } from "zod";
import { router, protectedProcedure } from "../trpc/index";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin, wrapAdminError } from "../supabaseAdmin.server";

/** Mood score mapping: higher = better. */
const MOOD_SCORE: Record<string, number> = {
  good: 4,
  okay: 3,
  difficult: 2,
  crisis: 1,
};

/** Human-readable label for the most recent mood value. */
const MOOD_LABEL: Record<string, string> = {
  good: "Good",
  okay: "Settled",
  difficult: "Difficult",
  crisis: "Hard",
};

/**
 * Build the last-N-days date buckets (UTC day strings) ending today.
 * Returns an array of ISO date strings: ["2026-04-16", ..., "2026-04-28"].
 */
function buildDayBuckets(days: number): string[] {
  const buckets: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.push(d.toISOString().slice(0, 10));
  }
  return buckets;
}

export const moodEntriesRouter = router({
  /**
   * Return 13-day mood sparkline data for a single recipient.
   * Auth: caller must be an accepted member of the org.
   */
  sparkline: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().uuid(),
        orgId: z.string().uuid(),
        days: z.number().min(1).max(30).default(13),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Auth gate: caller must be an accepted org member.
      const { data: membership } = await supabaseAdmin
        .from("memberships")
        .select("role")
        .eq("org_id", input.orgId)
        .eq("user_id", ctx.user.id)
        .not("accepted_at", "is", null)
        .single();

      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Fetch all mood entries in the last `days` days for this recipient.
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - (input.days - 1));
      since.setUTCHours(0, 0, 0, 0);

      const { data, error } = await supabaseAdmin
        .from("mood_entries")
        .select("mood, occurred_at")
        .eq("org_id", input.orgId)
        .eq("recipient_id", input.recipientId)
        .gte("occurred_at", since.toISOString())
        .order("occurred_at", { ascending: false });

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: wrapAdminError(error).message,
          cause: error,
        });
      }

      // Build day buckets and aggregate avg score per day.
      const buckets = buildDayBuckets(input.days);
      const dayMap: Record<string, number[]> = {};
      for (const bucket of buckets) {
        dayMap[bucket] = [];
      }

      for (const entry of data ?? []) {
        const day = entry.occurred_at.slice(0, 10);
        if (day in dayMap) {
          dayMap[day]!.push(MOOD_SCORE[entry.mood] ?? 0);
        }
      }

      // Convert to [0..1] bars (score 1..4 → 0..1) and find today's label.
      const todayKey = buckets[buckets.length - 1]!;
      const bars = buckets.map((day) => {
        const scores = dayMap[day]!;
        if (scores.length === 0) return 0;
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        // Normalise 1-4 → 0-1.
        return (avg - 1) / 3;
      });

      // Today's label: from the most recent entry today (first in desc order).
      const todayEntries = data?.filter(
        (e) => e.occurred_at.slice(0, 10) === todayKey,
      );
      const latestMood = todayEntries?.[0]?.mood ?? null;
      const todayLabel = latestMood
        ? (MOOD_LABEL[latestMood] ?? latestMood)
        : null;

      // Simple trend summary.
      const filledDays = bars.filter((b) => b > 0).length;
      let trendSummary: string;
      if (filledDays === 0) {
        trendSummary = "No mood readings in the last 13 days.";
      } else if (todayLabel) {
        trendSummary = `Mood readings shown for the last 13 days — today's reading: ${todayLabel}.`;
      } else {
        trendSummary = `Mood readings shown for the last ${filledDays} of 13 days.`;
      }

      return {
        bars,
        todayLabel,
        trendSummary,
        hasData: filledDays > 0,
      };
    }),
});
