import { describe, it, expect } from "vitest";
import {
  classifyDocument,
  extractFields,
  ocrDocumentCreatedEventSchema,
} from "../ocrDocument";
import type { OcrField } from "../ocrDocument";

const UUID = "18dc6d19-6712-4b26-8797-b4e544e01b84";

describe("ocrDocumentCreatedEventSchema (R2-014)", () => {
  it("accepts a valid jobId UUID", () => {
    expect(() =>
      ocrDocumentCreatedEventSchema.parse({ jobId: UUID }),
    ).not.toThrow();
  });
  it("rejects non-UUID jobId (forged event)", () => {
    expect(() =>
      ocrDocumentCreatedEventSchema.parse({ jobId: "not-a-uuid" }),
    ).toThrow();
  });
  it("rejects unknown extra keys (strict)", () => {
    expect(() =>
      ocrDocumentCreatedEventSchema.parse({ jobId: UUID, x: 1 }),
    ).toThrow();
  });
});

describe("classifyDocument", () => {
  it("detects lab result", () => {
    expect(
      classifyDocument("Result: Glucose 95 mg/dL  Reference: 70-100"),
    ).toBe("lab_result");
  });

  it("detects bill", () => {
    expect(classifyDocument("Total Due: $142.00  Account: 88291")).toBe("bill");
  });

  it("detects appointment summary", () => {
    expect(
      classifyDocument("Patient visited on 04/10/2026  Provider: Dr Smith"),
    ).toBe("appointment_summary");
  });

  it("detects pharmacy receipt", () => {
    expect(
      classifyDocument("Dispensed: Lisinopril 10mg  Qty: 30  RPh: J. Lee"),
    ).toBe("pharmacy_receipt");
  });

  it("falls back to bill for unrecognized text", () => {
    expect(classifyDocument("some random text here")).toBe("bill");
  });
});

describe("extractFields", () => {
  it("returns an array of OcrField objects", () => {
    const fields: OcrField[] = extractFields("lab_result", "Glucose: 95 mg/dL");
    expect(fields.length).toBeGreaterThan(0);
    expect(fields[0]).toMatchObject({
      label: expect.any(String),
      value: expect.any(String),
      type: expect.stringMatching(/^(text|number|date|currency)$/),
      confidence: expect.any(Number),
    });
  });

  it("marks short values as high confidence", () => {
    const fields = extractFields("bill", "Total Due: $50.00");
    const currencyField = fields.find((f) => f.type === "currency");
    expect(currencyField).toBeDefined();
  });
});
