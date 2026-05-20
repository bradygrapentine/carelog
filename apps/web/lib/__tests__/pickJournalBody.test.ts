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

// TD-141: pickJournalBody is now the SINGLE body-resolution policy for
// handoffSummary and VisitSummary (previously divergent — handoff read only
// `text`, VisitSummary read only `note ?? notes`). These cases pin the
// canonical precedence both consumers now share for every slot permutation,
// so the two surfaces can never disagree on the body of the same entry again.
describe("pickJournalBody — canonical precedence across all body slots", () => {
  const cases: Array<{
    payload: Record<string, unknown>;
    expected: string | null;
    why: string;
  }> = [
    {
      payload: { text: "T", note: "N", notes: "S" },
      expected: "T",
      why: "all three present → text wins",
    },
    {
      payload: { note: "N", notes: "S" },
      expected: "N",
      why: "no text → note wins over notes",
    },
    {
      payload: { text: "T", notes: "S" },
      expected: "T",
      why: "text present, note absent → text",
    },
    { payload: { notes: "S" }, expected: "S", why: "only notes → notes" },
    {
      payload: { text: "", note: "N" },
      expected: "N",
      why: "empty text is skipped → note",
    },
  ];

  for (const { payload, expected, why } of cases) {
    it(`resolves a single shared body (${why})`, () => {
      const body = pickJournalBody(payload);
      expect(body).toBe(expected);
      // Both handoffSummary and VisitSummary call pickJournalBody on the same
      // payload, so the body they display is identical by construction.
      expect(pickJournalBody({ ...payload })).toBe(body);
    });
  }
});
