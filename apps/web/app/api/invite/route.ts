import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { createInviteSchema } from "@carelog/schemas";
import { rateLimit } from "@/lib/rateLimit";
import { parseBody } from "@/lib/parseBody";
import { resend } from "@/server/resend.server";
import { getPostHogClient } from "@/lib/posthog-server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, "invite");
  if (limited) return limited;

  const { data: body, error: bodyError } = await parseBody(
    request,
    createInviteSchema,
  );
  if (bodyError) return bodyError;

  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { orgId, recipientId, role, email } = body;
    const normalizedEmail = email.toLowerCase().trim();

    // Verify the authenticated user is a coordinator in the target org.
    // supabaseAdmin bypasses RLS, so we must enforce this check explicitly.
    const { data: callerMembership } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .single();

    if (!callerMembership || callerMembership.role !== "coordinator") {
      return NextResponse.json(
        { error: "Only coordinators can send invites" },
        { status: 403 },
      );
    }

    // Check for an existing pending invite for this email + org.
    // invite_tokens links to memberships via membership_id; filter org_id via the join.
    const { data: existingInvite } = await supabaseAdmin
      .from("invite_tokens")
      .select("id, memberships!inner(org_id)")
      .eq("email", normalizedEmail)
      .eq("memberships.org_id", orgId)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (existingInvite && existingInvite.length > 0) {
      return NextResponse.json(
        {
          error:
            "An invite for this email is already pending for this care team",
        },
        { status: 409 },
      );
    }

    // Create a pending membership with user_id = null. The row doesn't yet belong
    // to the invitee — user_id is set to the accepting user's ID when they accept.
    // NULL is safe here: Postgres UNIQUE treats NULLs as distinct so multiple
    // pending invites to the same org+recipient don't conflict.
    const { data: membership, error: mError } = await supabaseAdmin
      .from("memberships")
      .insert({
        org_id: orgId,
        user_id: null,
        recipient_id: recipientId ?? null,
        role,
        invited_at: new Date().toISOString(),
        accepted_at: null,
      })
      .select("id")
      .single();

    if (mError || !membership) {
      return NextResponse.json(
        { error: "Failed to create membership" },
        { status: 500 },
      );
    }

    const { data: invite, error: iError } = await supabaseAdmin
      .from("invite_tokens")
      .insert({
        membership_id: membership.id,
        email: normalizedEmail,
      })
      .select("token")
      .single();

    if (iError || !invite) {
      return NextResponse.json(
        { error: "Failed to create invite token" },
        { status: 500 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = appUrl + "/invite/" + invite.token;

    if (resend) {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to: normalizedEmail,
        subject: "You have been invited to join a care team",
        html: [
          "<p>You have been invited to join a care team on CareSync.</p>",
          '<p><a href="' + inviteUrl + '">Accept your invitation</a></p>',
          "<p>This link expires in 48 hours.</p>",
        ].join(""),
      });
    } else {
      logger.info(
        "[invite] Resend not configured. Invite URL for",
        email,
        ":",
        inviteUrl,
      );
    }

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: "invite_sent",
      properties: { org_id: orgId, role, email_sent: !!resend },
    });

    return NextResponse.json({ success: true, inviteUrl });
  } catch (e: unknown) {
    logger.error("[invite] error:", e);
    const errorMessage =
      e instanceof Error ? e.message : "An unexpected error occurred";
    try {
      const posthog = getPostHogClient();
      const err = e instanceof Error ? e : new Error(errorMessage);
      posthog.capture({
        distinctId: "anonymous",
        event: "$exception",
        properties: {
          error_kind: err.name || "Error",
          route: "invite",
        },
      });
    } catch {}
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
