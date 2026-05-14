import type Stripe from "stripe";
import { logger } from "@/lib/logger";

export async function handle(event: Stripe.Event): Promise<void> {
  // v1: log only, no action
  logger.warn(
    "Stripe invoice.payment_failed for customer:",
    (event.data.object as Stripe.Invoice).customer,
  );
}
