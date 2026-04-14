import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createOrganization } from "@/server/repositories/organizationsRepository";
import { createIdentity } from "@/server/repositories/identityRepository";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";
import { parseBody } from "@/lib/parseBody";
import { getPostHogClient } from "@/lib/posthog-server";
import { logger } from "@/lib/logger";

const onboardingSchema = z.object({
  recipientName: z.string().min(1).max(200),
  recipientDob: z.string().max(10).nullable().optional(),
  orgName: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, "onboarding/create");
  if (limited) return limited;

  const { data: body, error: bodyError } = await parseBody(
    request,
    onboardingSchema,
  );
  if (bodyError) return bodyError;

  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientName, recipientDob, orgName } = body;
    const userId = user.id;

    const org = await createOrganization({
      name: orgName,
      orgType: "family",
    });

    const identityToken = await createIdentity({
      orgId: org.id,
      fullName: recipientName,
      dob: recipientDob || undefined,
    });

    const { data: recipient, error: rError } = await supabaseAdmin
      .from("care_recipients")
      .insert({
        org_id: org.id,
        identity_token: identityToken,
      })
      .select("id")
      .single();

    if (rError || !recipient) {
      return NextResponse.json(
        { error: "Failed to create care recipient" },
        { status: 500 },
      );
    }

    const { error: mError } = await supabaseAdmin.from("memberships").insert({
      org_id: org.id,
      user_id: userId,
      recipient_id: null,
      role: "coordinator",
      accepted_at: new Date().toISOString(),
    });

    if (mError) {
      return NextResponse.json(
        { error: "Failed to create membership" },
        { status: 500 },
      );
    }

    await supabaseAdmin
      .from("user_profiles")
      .update({ onboarded: true })
      .eq("id", userId);

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: "care_team_created_server",
      properties: { org_id: org.id, org_type: "family" },
    });

    return NextResponse.json({ success: true, orgId: org.id });
  } catch (e: unknown) {
    logger.error("[onboarding] error:", e);
    const errorMessage =
      e instanceof Error ? e.message : "Something went wrong";
    try {
      const posthog = getPostHogClient();
      const err = e instanceof Error ? e : new Error(errorMessage);
      posthog.capture({
        distinctId: "anonymous",
        event: "$exception",
        properties: {
          error_message: err.message,
          error_stack: err.stack,
          route: "onboarding/create",
        },
      });
    } catch {}
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
