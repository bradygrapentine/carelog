import type Stripe from "stripe";
import { getPostHogClient } from "@/lib/posthog-server";
import { logger } from "@/lib/logger";

export async function handle(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  try {
    const posthog = getPostHogClient();
    const customerId = subscription.customer as string;
    posthog.capture({
      distinctId: customerId,
      event: "subscription_updated",
      properties: {
        subscription_id: subscription.id,
        status: subscription.status,
        customer_id: customerId,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
    });
  } catch (e) {
    logger.warn("[stripe/webhook] posthog capture failed:", e);
  }
}
