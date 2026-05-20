import { z } from "zod";
import { inngest } from "../client";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";
import { sendPushToUser } from "../pushNotification";
import { capRawOcrText } from "../../lib/ocrSanitize";
import { resolveOcrStub } from "../../lib/ocr/devStub";

// Validated at handler entry — defense-in-depth against forged events (R2-014)
export const ocrDocumentCreatedEventSchema = z
  .object({ jobId: z.string().uuid() })
  .strict();
export type OcrDocumentCreatedEvent = z.infer<
  typeof ocrDocumentCreatedEventSchema
>;

export type OcrFieldType = "text" | "number" | "date" | "currency";
export type DocumentType =
  | "lab_result"
  | "appointment_summary"
  | "bill"
  | "pharmacy_receipt";

export type OcrField = {
  label: string;
  value: string;
  type: OcrFieldType;
  confidence: number;
};

export type ParsedDocument = {
  document_type: DocumentType;
  fields: OcrField[];
};

export function classifyDocument(rawText: string): DocumentType {
  const lower = rawText.toLowerCase();
  if (/result|glucose|hba1c|reference range|mg\/dl|mmol/.test(lower))
    return "lab_result";
  if (/dispensed|refill|qty|rph|pharmacy/.test(lower))
    return "pharmacy_receipt";
  if (/visited|provider|dr\.|diagnosis|follow.up/.test(lower))
    return "appointment_summary";
  return "bill";
}

export function extractFields(
  _docType: DocumentType,
  rawText: string,
): OcrField[] {
  const lines = rawText
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);
  const fields: OcrField[] = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const label = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (!label || !value) continue;

    const type = inferFieldType(value);
    const confidence = value.length < 20 ? 0.9 : 0.7;

    fields.push({ label, value, type, confidence });
  }

  if (fields.length === 0) {
    fields.push({
      label: "Content",
      value: rawText.slice(0, 80),
      type: "text",
      confidence: 0.5,
    });
  }

  return fields;
}

function inferFieldType(value: string): OcrFieldType {
  if (/^\$[\d,]+(\.\d{2})?$/.test(value)) return "currency";
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)) return "date";
  if (/^\d+(\.\d+)?$/.test(value)) return "number";
  return "text";
}

export const ocrDocument = inngest.createFunction(
  { id: "ocr-document" },
  { event: "ocr/document.created" },
  async ({ event, step }) => {
    const { jobId } = ocrDocumentCreatedEventSchema.parse(event.data);

    // Guard on status='pending' so an Inngest retry can't re-stamp a row that
    // already advanced (needs_review/confirmed) back to processing.
    await step.run("mark-processing", async () => {
      await supabaseAdmin
        .from("ocr_jobs")
        .update({ status: "processing" })
        .eq("id", jobId)
        .eq("status", "pending");
    });

    // Throw on missing row / DB error rather than continuing with null.
    const job = await step.run("fetch-job", async () => {
      const { data, error } = await supabaseAdmin
        .from("ocr_jobs")
        .select("image_url, created_by")
        .eq("id", jobId)
        .single();
      if (error || !data) {
        throw new Error(`ocr_job_not_found: ${jobId}`);
      }
      return data;
    });

    // Real provider call not yet wired (TD-203); stub only outside production,
    // null in production so a real upload never gets fabricated fields.
    const rawText = await step.run("call-ocr-api", async () => {
      return resolveOcrStub(
        "Patient: Jane Doe\nTest: Glucose\nResult: 95 mg/dL\nReference: 70-100 mg/dL\nDate: 04/10/2026",
      );
    });

    if (rawText === null) {
      await step.run("mark-failed-no-ocr", async () => {
        await supabaseAdmin
          .from("ocr_jobs")
          .update({ status: "failed" })
          .eq("id", jobId);
      });
      return;
    }

    await step.run("update-needs-review", async () => {
      const capped = capRawOcrText(rawText as string);
      const docType = classifyDocument(capped);
      const fields = extractFields(docType, capped);
      const parsed: ParsedDocument = { document_type: docType, fields };

      await supabaseAdmin
        .from("ocr_jobs")
        .update({
          status: "needs_review",
          raw_text: capped,
          parsed_data: parsed,
        })
        .eq("id", jobId);
    });

    await step.run("notify-uploader", async () => {
      const createdBy = (job as { created_by?: string } | null)?.created_by;
      if (!createdBy) return;
      await sendPushToUser(createdBy, {
        title: "Scan ready to review",
        body: "Your document has been processed. Tap to review the extracted fields.",
        data: { jobId, screen: "ocr-review" },
      });
    });
  },
);
