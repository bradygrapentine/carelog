// @vitest-environment node
import { z } from "zod";
import { inngest } from "../client";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";

// Validated at handler entry — defense-in-depth against forged events (R2-014)
export const documentsExtractTextEventSchema = z
  .object({ documentId: z.string().uuid() })
  .strict();
export type DocumentsExtractTextEvent = z.infer<
  typeof documentsExtractTextEventSchema
>;

/**
 * Pure helper: extract plain text from a raw file buffer.
 * - For PDFs: falls back to raw byte scanning for visible ASCII text runs.
 * - For images: no-ops gracefully when OCR_API_KEY is absent.
 * Returns null if extraction is not possible/configured.
 */
export function extractTextFromBuffer(
  buffer: ArrayBuffer,
  mimeType: string,
): string | null {
  const apiKey = process.env.OCR_API_KEY;

  if (mimeType === "application/pdf") {
    // Lightweight PDF text extraction: scan for visible ASCII runs between PDF stream markers.
    // This handles text-layer PDFs without a dependency. Scanned-only PDFs will return null
    // until a real OCR provider is wired via OCR_API_KEY.
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder("latin1");
    const raw = decoder.decode(bytes);
    // Extract runs of visible text from BT...ET blocks (PDF text operators)
    const runs: string[] = [];
    const btEtPattern = /BT([\s\S]*?)ET/g;
    let match: RegExpExecArray | null;
    while ((match = btEtPattern.exec(raw)) !== null) {
      const block = match[1];
      // Extract string literals: (text) or <hex>
      const literalPattern = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let lit: RegExpExecArray | null;
      while ((lit = literalPattern.exec(block)) !== null) {
        const text = lit[1]
          .replace(/\\n/g, " ")
          .replace(/\\r/g, " ")
          .replace(/\\t/g, " ")
          .replace(/\\(.)/g, "$1")
          .trim();
        if (text.length > 0) runs.push(text);
      }
    }
    if (runs.length > 0) return runs.join(" ").replace(/\s+/g, " ").trim();
    // If no text layer found and no OCR key, return null
    if (!apiKey) return null;
    // Real OCR call for scanned PDFs would go here
    return null;
  }

  if (mimeType.startsWith("image/")) {
    // OCR for images — no-op gracefully when key is absent (same pattern as ocrPrescription)
    if (!apiKey) return null;
    // Real OCR call would go here
    return null;
  }

  return null;
}

export const documentsExtractText = inngest.createFunction(
  { id: "documents-extract-text" },
  { event: "documents/extract-text" },
  async ({ event, step }) => {
    const { documentId } = documentsExtractTextEventSchema.parse(event.data);

    // Step 1: fetch the document row
    const doc = await step.run("fetch-document", async () => {
      const { data } = await supabaseAdmin
        .from("documents")
        .select("id, storage_path, doc_type")
        .eq("id", documentId)
        .single();
      return data;
    });

    if (!doc) return { ok: false, reason: "document not found" };

    // Step 2: download the file from storage
    const fileBuffer = await step.run("download-file", async () => {
      const { data, error } = await supabaseAdmin.storage
        .from("care-documents")
        .download(doc.storage_path);
      if (error || !data) return null;
      return data.arrayBuffer();
    });

    if (!fileBuffer) return { ok: false, reason: "file download failed" };

    // Step 3: extract text
    const extractedText = await step.run("extract-text", async () => {
      const ext = doc.storage_path.split(".").pop()?.toLowerCase() ?? "";
      const mimeMap: Record<string, string> = {
        pdf: "application/pdf",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        heic: "image/heic",
        heif: "image/heif",
      };
      const mime = mimeMap[ext] ?? "application/octet-stream";
      return extractTextFromBuffer(fileBuffer as ArrayBuffer, mime);
    });

    // Step 4: write back extracted_text (tsvector updates automatically via generated column)
    await step.run("update-extracted-text", async () => {
      if (extractedText === null) return; // nothing to write — OCR not configured or no text layer
      await supabaseAdmin
        .from("documents")
        .update({ extracted_text: extractedText })
        .eq("id", documentId);
    });

    return { ok: true, extracted: extractedText !== null };
  },
);
