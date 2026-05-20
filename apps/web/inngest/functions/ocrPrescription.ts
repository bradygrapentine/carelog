import { z } from "zod";
import { inngest } from "../client";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";
import { capRawOcrText, sanitizeOcrFields } from "../../lib/ocrSanitize";
import { resolveOcrStub } from "../../lib/ocr/devStub";

// Validated at handler entry — defense-in-depth against forged events (R2-014)
export const ocrJobCreatedEventSchema = z
  .object({ jobId: z.string().uuid() })
  .strict();
export type OcrJobCreatedEvent = z.infer<typeof ocrJobCreatedEventSchema>;

// Pure parsing function — testable without Inngest
export function parseOcrText(rawText: string): {
  drug_name: string;
  dosage: string | null;
  instructions: string | null;
} {
  const dosageMatch = rawText.match(/\b\d+\.?\d*\s*(?:mg|mcg|ml|g|IU)\b/i);
  const instructionsMatch = rawText.match(
    /(?:take|daily|twice|once|with\s+food|with\s+water)[^\n.]*/i,
  );
  const firstLine = rawText.split("\n")[0]?.trim() ?? rawText.slice(0, 50);

  return {
    drug_name:
      firstLine.replace(/\d+\.?\d*\s*(?:mg|mcg|ml|g|IU)/gi, "").trim() ||
      "Unknown",
    dosage: dosageMatch ? dosageMatch[0] : null,
    instructions: instructionsMatch ? instructionsMatch[0].trim() : null,
  };
}

export const ocrPrescription = inngest.createFunction(
  { id: "ocr-prescription" },
  { event: "ocr/job.created" },
  async ({ event, step }) => {
    const { jobId } = ocrJobCreatedEventSchema.parse(event.data);

    // Step 1: mark processing. Guard on status='pending' so an Inngest retry
    // after a later step fails cannot re-stamp a row that already advanced to
    // needs_review/confirmed back to processing (pending→processing is the only
    // valid transition per lib/ocr/jobStateMachine).
    await step.run("mark-processing", async () => {
      await supabaseAdmin
        .from("ocr_jobs")
        .update({ status: "processing" })
        .eq("id", jobId)
        .eq("status", "pending");
    });

    // Step 2: fetch the job. Throw on a missing row / DB error rather than
    // continuing with null — otherwise a bad jobId would store a parse result
    // against nothing and silently pass.
    const job = await step.run("fetch-job", async () => {
      const { data, error } = await supabaseAdmin
        .from("ocr_jobs")
        .select("image_url")
        .eq("id", jobId)
        .single();
      if (error || !data) {
        throw new Error(`ocr_job_not_found: ${jobId}`);
      }
      return data;
    });

    // Step 3: obtain OCR text. The real provider call is not yet wired (TD-203);
    // resolveOcrStub returns the fixture only outside production and null in
    // production, so a real upload never gets fabricated medication data.
    void job; // image_url consumed by the real provider call once wired
    const rawText = await step.run("call-ocr-api", async () => {
      return resolveOcrStub("Lisinopril 10mg\nTake once daily with water");
    });

    // No OCR available (production, no provider wired): fail the job so the UI
    // prompts manual entry instead of showing an invented prescription.
    if (rawText === null) {
      await step.run("mark-failed-no-ocr", async () => {
        await supabaseAdmin
          .from("ocr_jobs")
          .update({ status: "failed" })
          .eq("id", jobId);
      });
      return;
    }

    // Step 4: parse and update to needs_review
    await step.run("update-needs-review", async () => {
      const capped = capRawOcrText(rawText as string);
      const parsedRaw = parseOcrText(capped);
      const { fields: parsed, sanitized } = sanitizeOcrFields(parsedRaw);
      if (sanitized) {
        console.warn(
          `[ocrPrescription] drug_name failed allowlist — zeroed for job ${jobId}`,
        );
      }
      await supabaseAdmin
        .from("ocr_jobs")
        .update({
          status: "needs_review",
          raw_text: capped,
          parsed_payload: parsed,
        })
        .eq("id", jobId);
    });
  },
);
