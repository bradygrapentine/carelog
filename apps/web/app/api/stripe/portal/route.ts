import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getStripe } from "@/lib/stripe";
import { getPostHogClient } from "@/lib/posthog-server";
import { logger } from "@/lib/logger";

const portalSchema = z.object({
  orgId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = portalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { orgId } = parsed.data;

  // Verify coordinator
  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "coordinator") {
    return NextResponse.json(
      { error: "Only coordinators can manage billing" },
      { status: 403 },
    );
  }

  // Look up org stripe_id
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, stripe_id")
    .eq("id", orgId)
    .single();

  if (!org?.stripe_id) {
    return NextResponse.json(
      { error: "No active subscription" },
      { status: 400 },
    );
  }

  // H5: Validate Origin header to prevent CSRF / cross-origin billing portal abuse.
  const requestOrigin = request.headers.get("origin");
  const allowedOrigin =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const isAllowedOrigin =
    !requestOrigin ||
    requestOrigin === allowedOrigin ||
    requestOrigin === "http://localhost:3000";

  if (!isAllowedOrigin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const origin = allowedOrigin;

  const session = await getStripe().billingPortal.sessions.create({
    customer: org.stripe_id,
    return_url: origin + "/billing",
  });

  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: "billing_portal_opened",
      properties: { org_id: orgId },
    });
  } catch (e) {
    logger.warn("[stripe/portal] posthog capture failed:", e);
  }

  return NextResponse.json({ url: session.url });
}
