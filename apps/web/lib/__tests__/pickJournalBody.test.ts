import { describe, it, expect } from "vitest";
import { pickJournalBody } from "../pickJournalBody";

describe("pickJournalBody", () => {
  it("returns text when text is a non-empty string", () => {
    expect(pickJournalBody({ text: "first" })).toBe("first");
  });

  it("falls back to note when text is absent", () => {
    expect(pickJournalBody({ note: "n" })).toBe("n");
  });

  it("falls back to notes when text and note are absent", () => {
    expect(pickJournalBody({ notes: "ns" })).toBe("ns");
  });

  it("returns null when payload is null", () => {
    expect(pickJournalBody(null)).toBeNull();
  });

  it("returns null when all three slots are absent or empty", () => {
    expect(pickJournalBody({})).toBeNull();
    expect(pickJournalBody({ text: "", note: "", notes: "" })).toBeNull();
  });

  it("prefers text when text and note both present", () => {
    expect(pickJournalBody({ text: "t", note: "n" })).toBe("t");
  });

  it("skips non-string slots and falls through to the next", () => {
    expect(pickJournalBody({ text: 42, note: "n" })).toBe("n");
  });
});
