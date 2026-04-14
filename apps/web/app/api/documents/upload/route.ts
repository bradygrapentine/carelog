import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";
import { getPostHogClient } from "@/lib/posthog-server";
import { inngest } from "@/inngest/client";

const ALLOWED_DOC_TYPES = [
  "hipaa_authorization",
  "power_of_attorney",
  "advance_directive",
  "insurance_card",
  "medication_list",
  "other",
] as const;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
]);

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, "documents/upload");
  if (limited) return limited;

  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const orgId = formData.get("orgId")?.toString();
  const recipientId = formData.get("recipientId")?.toString();
  const displayName = formData.get("displayName")?.toString();
  const docType = formData.get("docType")?.toString();
  const file = formData.get("file");

  if (!orgId || !recipientId || !displayName || !docType) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(orgId) || !UUID_RE.test(recipientId)) {
    return NextResponse.json(
      { error: "Invalid org or recipient ID" },
      { status: 400 },
    );
  }

  if (
    !ALLOWED_DOC_TYPES.includes(docType as (typeof ALLOWED_DOC_TYPES)[number])
  ) {
    return NextResponse.json({ error: "Invalid doc_type" }, { status: 400 });
  }

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 10 MB limit" },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed. Use PDF, JPEG, PNG, or HEIC." },
      { status: 400 },
    );
  }

  // Role check
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("memberships")
    .select("role, accepted_at")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .single();

  if (membershipError || !membership || membership.role !== "coordinator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Upload to storage
  const MIME_TO_EXT: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const ext = MIME_TO_EXT[file.type] ?? "bin";
  const path =
    orgId + "/" + recipientId + "/" + crypto.randomUUID() + "." + ext;
  const arrayBuf = await file.arrayBuffer();

  const { error: storageError } = await supabaseAdmin.storage
    .from("care-documents")
    .upload(path, arrayBuf, {
      contentType: file.type || "application/octet-stream",
    });

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  // Insert metadata row
  const { data: doc, error: insertError } = await supabaseAdmin
    .from("documents")
    .insert({
      org_id: orgId,
      recipient_id: recipientId,
      uploaded_by: user.id,
      display_name: displayName,
      doc_type: docType,
      storage_path: path,
      file_size: file.size,
    })
    .select("id")
    .single();

  if (insertError || !doc) {
    await supabaseAdmin.storage.from("care-documents").remove([path]);
    return NextResponse.json(
      { error: "Failed to save document metadata" },
      { status: 500 },
    );
  }

  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: "document_uploaded",
      properties: {
        org_id: orgId,
        document_type: docType,
        mime_type: file.type,
        size_bytes: file.size,
        document_id: doc.id,
      },
    });
  } catch {
    // analytics failure must not break the endpoint
  }

  // Enqueue text extraction — non-blocking, must not fail the upload
  try {
    await inngest.send({
      name: "documents/extract-text",
      data: { documentId: doc.id },
    });
  } catch (err) {
    console.warn(
      "[documents/upload] inngest.send failed — text extraction skipped",
      err,
    );
  }

  return NextResponse.json({ documentId: doc.id });
}
