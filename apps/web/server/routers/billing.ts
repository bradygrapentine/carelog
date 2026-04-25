import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";

/**
 * Billing subscription status — mirrors the Stripe subscription lifecycle
 * but stored denormalised on `organizations.plan` + `stripe_id`.
 * The Stripe webhook (apps/web/app/api/stripe/webhook/route.ts) keeps this fresh.
 */
type SubscriptionStatus = "active" | "past_due" | "canceled";

type SubscriptionResult = {
  planName: string;
  status: SubscriptionStatus;
  renewalDate: string | null;
  seatCount: number;
} | null;

export const billingRouter = router({
  /**
   * Returns the caller's org subscription metadata.
   * - Returns `null` when the user has no active subscription (free plan / no stripe_id).
   * - Reads from `organizations` + `memberships` — no Stripe API call.
   * - Requires authenticated user (org_id derived from their membership).
   */
  getSubscription: protectedProcedure.query(
    async ({ ctx }): Promise<SubscriptionResult> => {
      const userId = ctx.user.id;

      // 1. Resolve the user's org via their membership row
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from("memberships")
        .select("org_id")
        .eq("user_id", userId)
        .not("accepted_at", "is", null)
        .limit(1)
        .single();

      if (membershipError) {
        // PGRST116 = no rows — user has no org yet
        if (membershipError.code === "PGRST116") {
          return null;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to look up membership",
        });
      }

      const orgId = membership.org_id;

      // 2. Fetch the org's plan + stripe_id
      const { data: org, error: orgError } = await supabaseAdmin
        .from("organizations")
        .select("id, plan, stripe_id")
        .eq("id", orgId)
        .single();

      if (orgError || !org) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load organisation",
        });
      }

      // Free plan with no Stripe customer = no active subscription
      if (org.plan === "free" || !org.stripe_id) {
        return null;
      }

      // 3. Count accepted members in this org for seatCount
      const { count, error: countError } = await supabaseAdmin
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .not("accepted_at", "is", null);

      if (countError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to count seats",
        });
      }

      // Derive status from plan value — webhook flips plan to 'free' on cancellation/deletion
      // and sets stripe_id to null. If stripe_id is set and plan != 'free', treat as active.
      const status: SubscriptionStatus = "active";

      return {
        planName: org.plan,
        status,
        // renewalDate: not stored in DB currently — webhook doesn't write it.
        // Return null; PP-014 can add a renewal_date column if needed.
        renewalDate: null,
        seatCount: count ?? 0,
      };
    },
  ),
});
