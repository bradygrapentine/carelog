import { describe, it, expect } from "vitest";
import { sniffMime, mimeMatches } from "../fileMagic";

function bytes(arr: number[]): Uint8Array {
  const out = new Uint8Array(Math.max(arr.length, 12));
  for (let i = 0; i < arr.length; i++) out[i] = arr[i];
  return out;
}

describe("sniffMime", () => {
  it("detects JPEG", () => {
    expect(sniffMime(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });

  it("detects PNG", () => {
    expect(
      sniffMime(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
  });

  it("detects PDF", () => {
    expect(sniffMime(bytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe(
      "application/pdf",
    );
  });

  it("detects HEIC (ftyp+heic)", () => {
    // bytes 0..3 = size, 4..7 = 'ftyp', 8..11 = 'heic'
    const b = bytes([
      0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]);
    expect(sniffMime(b)).toBe("image/heic");
  });

  it("returns null for unknown / text disguised as png", () => {
    const html = new TextEncoder().encode("<html><body>hi</body></html>");
    expect(sniffMime(html)).toBeNull();
  });
});

describe("mimeMatches", () => {
  it("accepts exact matches", () => {
    expect(mimeMatches("image/png", "image/png")).toBe(true);
  });

  it("accepts heic<->heif equivalence", () => {
    expect(mimeMatches("image/heic", "image/heif")).toBe(true);
    expect(mimeMatches("image/heif", "image/heic")).toBe(true);
  });

  it("rejects declared png when bytes are jpeg", () => {
    expect(mimeMatches("image/png", "image/jpeg")).toBe(false);
  });

  it("rejects when sniff returned null", () => {
    expect(mimeMatches("image/png", null)).toBe(false);
  });
});
