import { NextResponse, type NextRequest } from "next/server";
import { getRequestUser } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify the caller is a member of the org in session metadata
    const orgId = session.metadata?.orgId;
    if (orgId) {
      const { data: membership } = await supabaseAdmin
        .from("memberships")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", user.id)
        .single();
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({
      status: session.payment_status,
      plan: "family",
      interval: session.metadata?.interval ?? "month",
    });
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
