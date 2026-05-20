import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getStripe } from "@/lib/stripe";
import { getPostHogClient } from "@/lib/posthog-server";
import { logger } from "@/lib/logger";

const checkoutSchema = z.object({
  orgId: z.string().uuid(),
  interval: z.enum(["month", "year"]),
});

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { orgId, interval } = parsed.data;

  // Verify caller is coordinator
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();

  // Distinguish a transport/DB error (fail with 500) from a legitimate
  // no-membership row (fail-closed with 403). PGRST116 = no rows found.
  if (membershipError && membershipError.code !== "PGRST116") {
    logger.error("[stripe/checkout] membership lookup failed", {
      code: membershipError.code,
    });
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  if (!membership || membership.role !== "coordinator") {
    return NextResponse.json(
      { error: "Only coordinators can manage billing" },
      { status: 403 },
    );
  }

  // Look up org
  const { data: org, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("id, name, plan, stripe_id")
    .eq("id", orgId)
    .single();

  if (orgError && orgError.code !== "PGRST116") {
    logger.error("[stripe/checkout] org lookup failed", {
      code: orgError.code,
    });
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  if (org.plan !== "free") {
    return NextResponse.json(
      { error: "Organization already on a paid plan" },
      { status: 400 },
    );
  }

  // Get or create Stripe customer
  let customerId = org.stripe_id;
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: user.email ?? undefined,
      name: org.name,
      metadata: { orgId },
    });
    customerId = customer.id;
    const { error: stripeIdUpdateError } = await supabaseAdmin
      .from("organizations")
      .update({ stripe_id: customerId })
      .eq("id", orgId);
    if (stripeIdUpdateError) {
      // The Stripe customer now exists but isn't linked to the org — a future
      // checkout would create a second customer. Log the id for reconciliation
      // (never returned to the client) and fail rather than proceed unlinked.
      logger.error("[stripe/checkout] stripe customer orphaned", {
        customerId,
        code: stripeIdUpdateError.code,
      });
      return NextResponse.json(
        { error: "Could not start checkout" },
        { status: 500 },
      );
    }
  }

  // Create Checkout Session
  const priceId =
    interval === "year"
      ? process.env.STRIPE_PRICE_ANNUAL
      : process.env.STRIPE_PRICE_MONTHLY;

  // Fail closed if the price env var is unset — never hand Stripe a session
  // with `price: undefined` (it would 500 deep in the SDK with no context).
  if (!priceId) {
    logger.error("[stripe/checkout] price env var missing", { interval });
    return NextResponse.json(
      { error: "Billing temporarily unavailable" },
      { status: 400 },
    );
  }

  // F-010: Never trust the request Origin header — Stripe will redirect to
  // success_url/cancel_url after checkout, so an attacker-controlled Origin
  // could phish customers via a bogus success page. Use only the configured
  // app URL.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: origin + "/billing/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/pricing",
    metadata: { orgId, interval },
  });

  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: "checkout_started",
      properties: {
        org_id: orgId,
        price_id: priceId,
        plan: interval === "year" ? "annual" : "monthly",
        interval,
      },
    });
  } catch (e) {
    logger.warn("[stripe/checkout] posthog capture failed:", e);
  }

  return NextResponse.json({ url: session.url });
}
