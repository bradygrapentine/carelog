import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { stripe } from "@/lib/stripe";

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

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_id,
    return_url: origin + "/billing",
  });

  return NextResponse.json({ url: session.url });
}
