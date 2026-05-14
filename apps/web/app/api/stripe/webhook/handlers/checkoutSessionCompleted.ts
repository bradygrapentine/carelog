import type Stripe from "stripe";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getPostHogClient } from "@/lib/posthog-server";
import { logger } from "@/lib/logger";

export async function handle(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const orgId = session.metadata?.orgId;
  if (orgId) {
    await supabaseAdmin
      .from("organizations")
      .update({ plan: "family", stripe_id: session.customer as string })
      .eq("id", orgId);
  }
  try {
    const posthog = getPostHogClient();
    const userId = session.metadata?.userId;
    const customerId = (session.customer as string) ?? "";
    posthog.capture({
      distinctId: userId ?? customerId,
      event: "checkout_completed",
      properties: {
        org_id: orgId,
        subscription_id: session.subscription as string | null,
        amount_total: session.amount_total,
        customer_id: customerId,
      },
    });
  } catch (e) {
    logger.warn("[stripe/webhook] posthog capture failed:", e);
  }
}
