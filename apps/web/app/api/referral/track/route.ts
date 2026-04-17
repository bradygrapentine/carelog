import { NextResponse, type NextRequest } from "next/server";
import { getRequestUser } from "@/lib/supabaseServer";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { orgId?: string; userId?: string };
    const orgId = body.orgId;

    if (!orgId || typeof orgId !== "string") {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    // PHI rule: distinctId and all properties use UUID only — no email, name, or PII
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: "referral_shared",
      properties: {
        org_id: orgId,
      },
    });
  } catch {
    // analytics are non-critical — swallow errors silently
  }

  return NextResponse.json({ ok: true });
}
