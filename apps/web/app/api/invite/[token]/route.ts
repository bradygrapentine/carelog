import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const limited = await rateLimit(request, "invite/token");
  if (limited) return limited;

  try {
    const { token } = await params;

    const { data: invite, error } = await supabaseAdmin
      .from("invite_tokens")
      .select(
        "id, email, consumed_at, expires_at, membership_id, invited_by_user_id",
      )
      .eq("token", token)
      .single();

    if (error || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.consumed_at) {
      return NextResponse.json(
        { error: "This invite has already been used" },
        { status: 410 },
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invite has expired" },
        { status: 410 },
      );
    }

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("role, org_id, organizations(name)")
      .eq("id", invite.membership_id)
      .single();

    const orgName =
      (membership as unknown as { organizations?: { name: string } })
        ?.organizations?.name ?? "Care team";

    let inviterName: string | null = null;
    if (invite.invited_by_user_id) {
      const { data: inviter } = await supabaseAdmin
        .from("user_profiles")
        .select("display_name")
        .eq("id", invite.invited_by_user_id)
        .single();
      inviterName = inviter?.display_name ?? null;
    }

    return NextResponse.json({
      email: invite.email,
      role: membership?.role,
      orgName,
      inviterName,
    });
  } catch {
    // Don't leak raw exception messages to the client.
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 },
    );
  }
}
