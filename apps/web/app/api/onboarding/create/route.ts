import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createOrganization } from "@/server/repositories/organizationsRepository";
import { createIdentity } from "@/server/repositories/identityRepository";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const onboardingSchema = z.object({
  recipientName: z.string().min(1).max(200),
  recipientDob:  z.string().nullable().optional(),
  orgName:       z.string().min(1).max(100),
  userId:        z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = onboardingSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0].message },
        { status: 400 },
      );
    }

    const { recipientName, recipientDob, orgName, userId } = body.data;

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

    return NextResponse.json({ success: true, orgId: org.id });
  } catch (e: unknown) {
    console.error("[onboarding] error:", e);
    const errorMessage = e instanceof Error ? e.message : "Something went wrong";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
