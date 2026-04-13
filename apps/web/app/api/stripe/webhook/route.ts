import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
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
          console.warn("[stripe/webhook] posthog capture failed:", e);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
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
          console.warn("[stripe/webhook] posthog capture failed:", e);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("stripe_id", customerId)
          .single();

        if (org) {
          await supabaseAdmin
            .from("organizations")
            .update({ plan: "free", stripe_id: null })
            .eq("id", org.id);
        }
        break;
      }

      case "invoice.payment_failed": {
        // v1: log only, no action
        console.warn(
          "Stripe invoice.payment_failed for customer:",
          event.data.object.customer,
        );
        break;
      }
    }
  } catch (e: unknown) {
    console.error("[stripe/webhook] error:", e);
    try {
      const posthog = getPostHogClient();
      const err =
        e instanceof Error ? e : new Error("Unknown stripe webhook error");
      const distinctId =
        (event.data.object as { customer?: string } | undefined)?.customer ??
        "anonymous";
      posthog.capture({
        distinctId,
        event: "$exception",
        properties: {
          error_message: err.message,
          error_stack: err.stack,
          route: "stripe/webhook",
          event_type: event.type,
        },
      });
    } catch {}
  }

  return NextResponse.json({ received: true });
}
