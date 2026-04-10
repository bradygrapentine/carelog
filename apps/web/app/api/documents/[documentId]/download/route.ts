import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";

const SIGNED_URL_EXPIRY_SECONDS = 180;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const limited = await rateLimit(request, "documents/download");
  if (limited) return limited;

  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId } = await params;

  const { data: doc, error: docError } = await supabaseAdmin
    .from("documents")
    .select("id, org_id, storage_path")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("memberships")
    .select("role")
    .eq("org_id", doc.org_id)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from("care-documents")
    .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY_SECONDS);

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: "Could not generate download link" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signedData.signedUrl, { status: 302 });
}
