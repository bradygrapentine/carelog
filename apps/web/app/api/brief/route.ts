import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { classifyBrief } from "@/lib/brief/headline";

const createBriefSchema = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  title: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createBriefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { org_id, recipient_id, title } = parsed.data;

    // Verify caller is coordinator for this org
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("memberships")
      .select("role, accepted_at")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (
      membershipError ||
      !membership ||
      membership.role !== "coordinator" ||
      !membership.accepted_at
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch recipient to get identity_token
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from("care_recipients")
      .select("identity_token")
      .eq("id", recipient_id)
      .eq("org_id", org_id)
      .single();

    if (recipientError || !recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 },
      );
    }

    // De-tokenize: read identity_vault via supabaseAdmin (service role only)
    const { data: vault, error: vaultError } = await supabaseAdmin
      .from("identity_vault")
      .select("full_name, dob")
      .eq("token", recipient.identity_token)
      .single();

    if (vaultError || !vault) {
      return NextResponse.json(
        { error: "Identity not found" },
        { status: 404 },
      );
    }

    const fullName = vault.full_name;
    const dob = vault.dob ?? null;

    // Window: events since the previous brief for this recipient.
    // Falls back to the last 24h on the first brief — keeps the
    // "today's brief" framing tight per the brief shape doc.
    const { data: previousBrief } = await supabaseAdmin
      .from("care_briefs")
      .select("created_at")
      .eq("recipient_id", recipient_id)
      .eq("org_id", org_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const windowStart =
      previousBrief?.created_at ??
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: entries } = await supabaseAdmin
      .from("care_events")
      .select("occurred_at, payload, flagged")
      .eq("recipient_id", recipient_id)
      .eq("entry_kind", "human")
      .eq("event_type", "journal")
      .gte("occurred_at", windowStart)
      .order("occurred_at", { ascending: false })
      .limit(20);

    // Fetch active medications for recipient
    const { data: medications } = await supabaseAdmin
      .from("medications")
      .select("drug_name, dosage, instructions")
      .eq("recipient_id", recipient_id)
      .eq("active", true);

    // Build snapshot — name is resolved once, never accessed from vault at view time
    const content = {
      recipient_name: fullName,
      dob,
      generated_at: new Date().toISOString(),
      medications: (medications ?? []).map(
        (m: {
          drug_name: string;
          dosage: string | null;
          instructions: string | null;
        }) => ({
          drug_name: m.drug_name,
          dosage: m.dosage,
          instructions: m.instructions,
        }),
      ),
      recent_entries: (entries ?? []).map(
        (e: {
          occurred_at: string;
          payload: { text?: string; mood?: string } | null;
          flagged: boolean;
        }) => ({
          occurred_at: e.occurred_at,
          text: e.payload?.text,
          mood: e.payload?.mood,
          flagged: e.flagged,
        }),
      ),
    };

    // Editorial headline: classify the snapshot into a named state and
    // emit a structured Span[]. Stored alongside the plain-text title
    // (kept for emails / print fallback) per the Italic-Emphasis Rule.
    const { headline } = classifyBrief({
      recipientName: fullName,
      entries: content.recent_entries.map((e) => ({
        occurred_at: e.occurred_at,
        mood: e.mood,
        flagged: e.flagged,
      })),
    });

    // Insert care_brief
    const { data: brief, error: insertError } = await supabaseAdmin
      .from("care_briefs")
      .insert({
        org_id,
        recipient_id,
        title: title ?? "Care brief",
        content,
        headline,
        includes: ["medications", "journal"],
        created_by: user.id,
      })
      .select("id, share_token")
      .single();

    if (insertError || !brief) {
      return NextResponse.json(
        { error: insertError?.message ?? "Insert failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ share_token: brief.share_token, id: brief.id });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "An unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
