import { NextResponse, type NextRequest } from "next/server";
import { getRequestUser } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripe";

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
    return NextResponse.json({
      status: session.payment_status,
      plan: "family",
      interval: session.metadata?.interval ?? "month",
    });
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
}
