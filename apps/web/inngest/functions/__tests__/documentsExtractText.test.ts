// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  documentsExtractTextEventSchema,
  extractTextFromBuffer,
} from "../documentsExtractText";

// ─── Schema validation ────────────────────────────────────────────────────────

const VALID_UUID = "18dc6d19-6712-4b26-8797-b4e544e01b84";

describe("documentsExtractTextEventSchema (R2-014)", () => {
  it("accepts a valid documentId UUID", () => {
    expect(() =>
      documentsExtractTextEventSchema.parse({ documentId: VALID_UUID }),
    ).not.toThrow();
  });

  it("rejects non-UUID documentId (forged event)", () => {
    expect(() =>
      documentsExtractTextEventSchema.parse({ documentId: "not-a-uuid" }),
    ).toThrow();
  });

  it("rejects missing documentId", () => {
    expect(() => documentsExtractTextEventSchema.parse({})).toThrow();
  });

  it("rejects unknown extra keys (strict)", () => {
    expect(() =>
      documentsExtractTextEventSchema.parse({
        documentId: VALID_UUID,
        extra: 1,
      }),
    ).toThrow();
  });
});

// ─── extractTextFromBuffer ────────────────────────────────────────────────────

function strToBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer as ArrayBuffer;
}

describe("extractTextFromBuffer — image types without OCR_API_KEY", () => {
  it("returns null for image/jpeg when OCR_API_KEY is not set", () => {
    const buf = strToBuffer("fake image bytes");
    expect(extractTextFromBuffer(buf, "image/jpeg")).toBeNull();
  });

  it("returns null for image/png when OCR_API_KEY is not set", () => {
    const buf = strToBuffer("fake image bytes");
    expect(extractTextFromBuffer(buf, "image/png")).toBeNull();
  });

  it("returns null for unknown mime types", () => {
    const buf = strToBuffer("something");
    expect(extractTextFromBuffer(buf, "application/octet-stream")).toBeNull();
  });
});

describe("extractTextFromBuffer — PDF with text layer", () => {
  it("extracts text from a minimal PDF BT...ET block", () => {
    // Construct a synthetic PDF-like byte sequence with a BT...ET block
    const syntheticPdf = `%PDF-1.4
1 0 obj
stream
BT
/F1 12 Tf
(Dr. Chen POA document) Tj
(Second line of text) Tj
ET
endstream`;
    const buf = strToBuffer(syntheticPdf);
    const result = extractTextFromBuffer(buf, "application/pdf");
    expect(result).not.toBeNull();
    expect(result).toContain("Dr. Chen POA document");
    expect(result).toContain("Second line of text");
  });

  it("returns null for a PDF with no BT...ET blocks and no OCR_API_KEY", () => {
    const buf = strToBuffer("%PDF-1.4\n1 0 obj\nendobj");
    const result = extractTextFromBuffer(buf, "application/pdf");
    expect(result).toBeNull();
  });

  it("handles PDF with escaped parens in literal strings", () => {
    const syntheticPdf = `BT (Hello \\(World\\)) Tj ET`;
    const buf = strToBuffer(syntheticPdf);
    const result = extractTextFromBuffer(buf, "application/pdf");
    expect(result).not.toBeNull();
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });
});
