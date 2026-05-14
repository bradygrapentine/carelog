import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getPostHogClient } from "@/lib/posthog-server";
import { logger } from "@/lib/logger";
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
