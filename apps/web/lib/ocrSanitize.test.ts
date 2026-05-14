import { describe, expect, it } from "vitest";
import {
  MAX_OCR_RAW_TEXT_BYTES,
  capRawOcrText,
  isAllowedDrugName,
  sanitizeOcrFields,
} from "./ocrSanitize";

describe("capRawOcrText", () => {
  it("returns unchanged string when bytes < 8KB", () => {
    const s = "A".repeat(7 * 1024); // 7KB ASCII
    expect(capRawOcrText(s)).toBe(s);
  });

  it("truncates to ≤8KB when input is 9KB", () => {
    const s = "B".repeat(9 * 1024); // 9KB ASCII
    const result = capRawOcrText(s);
    const byteLen = new TextEncoder().encode(result).length;
    expect(byteLen).toBeLessThanOrEqual(MAX_OCR_RAW_TEXT_BYTES);
  });

  it("returns unchanged string at exactly 8KB", () => {
    const s = "C".repeat(MAX_OCR_RAW_TEXT_BYTES); // exactly 8192 bytes
    expect(capRawOcrText(s)).toBe(s);
  });
});

describe("isAllowedDrugName", () => {
  it("allows a plain drug name", () => {
    expect(isAllowedDrugName("Lisinopril")).toBe(true);
  });

  it("allows drug name with spaces and digits", () => {
    expect(isAllowedDrugName("Lisinopril 10mg")).toBe(true);
  });

  it("rejects script injection", () => {
    expect(isAllowedDrugName("<script>")).toBe(false);
  });

  it("rejects empty string (length lower bound is 1)", () => {
    expect(isAllowedDrugName("")).toBe(false);
  });

  it("rejects string exceeding 80 chars (length upper bound)", () => {
    expect(isAllowedDrugName("A".repeat(81))).toBe(false);
  });

  it("accepts string of exactly 80 chars", () => {
    expect(isAllowedDrugName("A".repeat(80))).toBe(true);
  });
});

describe("sanitizeOcrFields", () => {
  it("zeroes drug_name and flags sanitized:true when name is bad", () => {
    const result = sanitizeOcrFields({ drug_name: "<bad>" });
    expect(result).toEqual({ fields: { drug_name: "" }, sanitized: true });
  });

  it("passes good drug_name through unchanged", () => {
    const result = sanitizeOcrFields({ drug_name: "Aspirin" });
    expect(result).toEqual({
      fields: { drug_name: "Aspirin" },
      sanitized: false,
    });
  });

  it("returns sanitized:false when drug_name is absent", () => {
    const fields: { drug_name?: string; dosage: string } = { dosage: "10mg" };
    const result = sanitizeOcrFields(fields);
    expect(result.sanitized).toBe(false);
    expect(result.fields).toBe(fields); // same reference — no copy needed
  });
});
