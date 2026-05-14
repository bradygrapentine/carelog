import type Stripe from "stripe";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

export async function handle(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
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
}
