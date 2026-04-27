import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, "members");
  if (limited) return limited;

  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    const parsed = z.string().uuid().safeParse(orgId);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid orgId" }, { status: 400 });
    }

    // Verify the authenticated user is an active member of the requested org.
    // supabaseAdmin bypasses RLS, so we must enforce this check explicitly.
    const { data: callerMembership } = await supabaseAdmin
      .from("memberships")
      .select("id, role")
      .eq("org_id", parsed.data)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .single();

    if (!callerMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // H3: Only coordinators may see email addresses
    const isCoordinator = callerMembership.role === "coordinator";

    const { data: memberships, error } = await supabaseAdmin
      .from("memberships")
      .select("id, role, user_id")
      .eq("org_id", parsed.data)
      .not("accepted_at", "is", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Batch-resolve display names from user_profiles — one query replaces N auth.admin calls.
    // user_profiles.display_name is set on signup via trigger: COALESCE(full_name, email local part).
    const userIds = (memberships ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("user_profiles")
      .select("id, display_name, email")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        {
          display_name: p.display_name as string | null,
          email: p.email as string | null,
        },
      ]),
    );

    const members = (memberships ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      user_id: m.user_id,
      display_name: profileMap.get(m.user_id)?.display_name ?? null,
      email: isCoordinator ? (profileMap.get(m.user_id)?.email ?? null) : null,
    }));

    return NextResponse.json({ members });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "An unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
