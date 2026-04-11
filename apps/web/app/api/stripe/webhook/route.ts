import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

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

  return NextResponse.json({ received: true });
}
