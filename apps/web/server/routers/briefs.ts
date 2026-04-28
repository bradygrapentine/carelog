import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";

export const briefsRouter = router({
  /**
   * Returns the most-recent non-revoked care_brief for a given
   * (recipientId, orgId) pair — used by BriefHero on the dashboard.
   *
   * The user must be a team member for the recipient (enforced by the
   * RLS policy "briefs readable by team" — user_can_access_recipient).
   * We use ctx.supabase (anon key, RLS on) rather than supabaseAdmin so
   * PHI only flows to callers who are authorized coordinators/helpers.
   */
  latestForRecipient: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().uuid(),
        orgId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("care_briefs")
        .select("id, title, content, includes, created_at")
        .eq("recipient_id", input.recipientId)
        .eq("org_id", input.orgId)
        .eq("revoked", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      // null → no brief exists yet (not an error — caller renders empty state)
      return data ?? null;
    }),
});
