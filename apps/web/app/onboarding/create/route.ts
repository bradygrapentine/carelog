import { NextResponse, type NextRequest } from "next/server";
import { createOrganization } from "@/server/repositories/organizationsRepository";
import { createIdentity } from "@/server/repositories/identityRepository";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { recipientName, recipientDob, orgName, userId } =
      await request.json();

    if (!recipientName || !orgName || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 1. Create organization
    const org = await createOrganization({
      name: orgName,
      orgType: "family",
    });

    // 2. Create identity in vault
    const identityToken = await createIdentity({
      orgId: org.id,
      fullName: recipientName,
      dob: recipientDob || undefined,
    });

    // 3. Create care recipient
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

    // 4. Create coordinator membership
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

    // 5. Mark user as onboarded
    await supabaseAdmin
      .from("user_profiles")
      .update({ onboarded: true })
      .eq("id", userId);

    return NextResponse.json({ success: true, orgId: org.id });
  } catch (e: unknown) {
    logger.error("[onboarding] error:", e);
    const errorMessage =
      typeof e === "object" && e !== null && "message" in e
        ? (e as { message?: string }).message
        : undefined;
    return NextResponse.json(
      { error: errorMessage ?? "Something went wrong" },
      { status: 500 },
    );
  }
}
