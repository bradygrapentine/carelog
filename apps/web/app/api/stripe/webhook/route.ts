import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getPostHogClient } from "@/lib/posthog-server";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { handlers } from "./handlers";

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

  // SEC-002: Replay protection — deduplicate by Stripe event ID.
  // upsert with ignoreDuplicates: true returns empty data array on conflict.
  const { data: dedupRows, error: dedupError } = await supabaseAdmin
    .from("stripe_events")
    .upsert(
      { event_id: event.id, event_type: event.type },
      { onConflict: "event_id", ignoreDuplicates: true },
    )
    .select();

  if (dedupError) {
    logger.error("[stripe/webhook] dedup insert error:", dedupError);
    return NextResponse.json({ error: "Dedup check failed" }, { status: 500 });
  }

  if (!dedupRows || dedupRows.length === 0) {
    // Row already existed — this is a duplicate delivery. Short-circuit safely.
    return NextResponse.json({ duplicate: true }, { status: 200 });
  }

  try {
    await handlers[event.type]?.(event);
  } catch (e: unknown) {
    logger.error("[stripe/webhook] error:", e);
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
