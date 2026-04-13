import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { inngest } from "@/inngest/client";
import { rateLimit } from "@/lib/rateLimit";
import { sniffMime, mimeMatches } from "@/lib/fileMagic";
import { getPostHogClient } from "@/lib/posthog-server";

const uploadBodySchema = z.object({
  orgId: z.string().uuid(),
  recipientId: z.string().uuid(),
  category: z.enum(["prescription", "document"]).default("prescription"),
});

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, "ocr/upload");
  if (limited) return limited;

  try {
    const user = await getRequestUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Parse multipart form data — DO NOT use request.json()
    const formData = await request.formData();

    const orgId = formData.get("orgId");
    const recipientId = formData.get("recipientId");
    const file = formData.get("file");
    const category = (formData.get("category") as string) ?? "prescription";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const parsed = uploadBodySchema.safeParse({
      orgId,
      recipientId,
      category,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid orgId or recipientId" },
        { status: 400 },
      );
    }

    const { orgId: validOrgId, recipientId: validRecipientId } = parsed.data;

    // Verify the user is a coordinator in this org
    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("org_id", validOrgId)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .single();

    if (!membership || membership.role !== "coordinator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify recipient belongs to org
    const { data: recipient } = await supabaseAdmin
      .from("care_recipients")
      .select("id")
      .eq("id", validRecipientId)
      .eq("org_id", validOrgId)
      .single();

    if (!recipient) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // F-012: Never embed user-supplied file.name in the storage path —
    // path-traversal payloads (e.g. "../other-org/evil.pdf") could land
    // objects in sibling org prefixes. Use a random UUID with an extension
    // derived strictly from the MIME type allowlist.
    const MIME_TO_EXT: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/heic": "heic",
      "image/heif": "heif",
      "application/pdf": "pdf",
    };
    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    }

    // Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer();

    // R2-003: magic-byte sniff. The file.type header is client-controlled; we
    // must verify the actual bytes match the declared type before trusting the
    // extension/content-type we persist and later serve back via signed URL.
    const head = new Uint8Array(fileBuffer.slice(0, 12));
    const sniffed = sniffMime(head);
    if (!sniffed || !mimeMatches(file.type, sniffed)) {
      return NextResponse.json(
        { error: "File content does not match declared type" },
        { status: 400 },
      );
    }
    const filePath =
      validOrgId +
      "/" +
      validRecipientId +
      "/" +
      Date.now() +
      "-" +
      crypto.randomUUID() +
      "." +
      ext;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("prescription-images")
      .upload(filePath, fileBuffer, { contentType: file.type });

    if (uploadError) {
      return NextResponse.json(
        { error: "Upload failed: " + uploadError.message },
        { status: 500 },
      );
    }

    // Store the storage path (not a public URL). The bucket is private;
    // consumers must use createSignedUrl at serve-time to access the object.
    // The image_url column is retained for backward compatibility and now
    // holds the storage path.
    // Insert OCR job row
    const { data: job, error: insertError } = await supabaseAdmin
      .from("ocr_jobs")
      .insert({
        org_id: validOrgId,
        recipient_id: validRecipientId,
        image_url: filePath,
        status: "pending",
        created_by: user.id,
        category: parsed.data.category,
      })
      .select("id")
      .single();

    if (insertError || !job) {
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 },
      );
    }

    // Fire Inngest event — route by category
    const eventName =
      parsed.data.category === "prescription"
        ? "ocr/job.created"
        : "ocr/document.created";
    await inngest.send({ name: eventName, data: { jobId: job.id } });

    try {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: user.id,
        event: "ocr_job_started",
        properties: {
          org_id: validOrgId,
          document_id: filePath,
          job_id: job.id,
        },
      });
    } catch {
      // analytics failure must not break the endpoint
    }

    return NextResponse.json({ jobId: job.id });
  } catch (e: unknown) {
    const errorMessage =
      e instanceof Error ? e.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
