// Magic-byte sniffer for the OCR upload allowlist (image/jpeg, image/png,
// image/heic, image/heif, application/pdf). Returns the canonical MIME type
// detected from the first bytes, or null if no known signature matches.
// Kept dependency-free and deliberately small — we only need to verify the
// declared file.type matches the actual bytes for the allowlist.

export type SniffedMime =
  | "image/jpeg"
  | "image/png"
  | "image/heic"
  | "image/heif"
  | "application/pdf";

export function sniffMime(bytes: Uint8Array): SniffedMime | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // PDF: %PDF- (25 50 44 46 2D)
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }
  // HEIC/HEIF: bytes[4..8] === 'ftyp' and bytes[8..12] brand is one of heic/heix/heif/mif1/msf1/hevc/hevx
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (
      brand === "heic" ||
      brand === "heix" ||
      brand === "hevc" ||
      brand === "hevx"
    ) {
      return "image/heic";
    }
    if (brand === "mif1" || brand === "msf1" || brand === "heif") {
      return "image/heif";
    }
  }
  return null;
}

// Given a declared MIME and sniffed MIME, returns true if the declaration is
// consistent with the actual bytes. HEIC/HEIF are treated as interchangeable
// since the brand matrix overlaps in practice.
export function mimeMatches(
  declared: string,
  sniffed: SniffedMime | null,
): boolean {
  if (!sniffed) return false;
  if (declared === sniffed) return true;
  const heicish = new Set(["image/heic", "image/heif"]);
  if (heicish.has(declared) && heicish.has(sniffed)) return true;
  return false;
}
