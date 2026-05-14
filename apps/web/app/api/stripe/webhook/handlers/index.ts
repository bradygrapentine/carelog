import type Stripe from "stripe";
import { handle as handleCheckoutSessionCompleted } from "./checkoutSessionCompleted";
import { handle as handleCustomerSubscriptionUpdated } from "./customerSubscriptionUpdated";
import { handle as handleCustomerSubscriptionDeleted } from "./customerSubscriptionDeleted";
import { handle as handleInvoicePaymentFailed } from "./invoicePaymentFailed";

export const handlers: Record<string, (event: Stripe.Event) => Promise<void>> =
  {
    "checkout.session.completed": handleCheckoutSessionCompleted,
    "customer.subscription.updated": handleCustomerSubscriptionUpdated,
    "customer.subscription.deleted": handleCustomerSubscriptionDeleted,
    "invoice.payment_failed": handleInvoicePaymentFailed,
  };
