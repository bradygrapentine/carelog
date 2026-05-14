import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> },
) {
  const limited = await rateLimit(request, "brief/share");
  if (limited) return limited;

  try {
    const { shareToken } = await params;

    const { data: brief, error } = await supabaseAdmin
      .from("care_briefs")
      .select("id, title, content, includes, expires_at, revoked, created_at")
      .eq("share_token", shareToken)
      .eq("revoked", false)
      .single();

    if (error || !brief) {
      return NextResponse.json(
        { error: "Care brief not found" },
        { status: 404 },
      );
    }

    // Check expiry if set
    if (brief.expires_at && new Date(brief.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This care brief has expired" },
        { status: 410 },
      );
    }

    // PHI gate (UX-045): redact `dob` from content unless `includes` opts in.
    // Default family-share briefs ship without `"dob"` in `includes`, so DOB
    // stays in the stored snapshot but never reaches the viewer. Clinician
    // briefs that need DOB must explicitly include `"dob"` at write time.
    const includes = (brief.includes ?? []) as string[];
    const rawContent = (brief.content ?? {}) as Record<string, unknown>;
    let content: Record<string, unknown> = rawContent;
    if (!includes.includes("dob") && "dob" in rawContent) {
      const { dob: _dob, ...rest } = rawContent;
      content = rest;
    }

    return NextResponse.json({
      id: brief.id,
      title: brief.title,
      content,
      includes,
      created_at: brief.created_at,
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "An unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
