import { describe, expect, it } from "vitest";
import {
  classifyBrief,
  parseStoredHeadline,
  type HeadlineEntry,
} from "../headline";

function entry(
  partial: Partial<HeadlineEntry> & Pick<HeadlineEntry, "occurred_at">,
): HeadlineEntry {
  return { flagged: false, ...partial };
}

function joinHeadline(spans: Array<{ text: string; em?: boolean }>): string {
  return spans.map((s) => s.text).join("");
}

function emphasized(spans: Array<{ text: string; em?: boolean }>): string[] {
  return spans.filter((s) => s.em).map((s) => s.text);
}

describe("classifyBrief", () => {
  it("returns the empty state when there are no entries", () => {
    const { state, headline } = classifyBrief({
      recipientName: "Eleanor Smith",
      entries: [],
    });
    expect(state).toBe("empty");
    expect(joinHeadline(headline)).toMatch(/no notes for/i);
    expect(emphasized(headline)).toEqual(["Eleanor"]);
  });

  it("classifies any crisis-mood entry as crisis (singular)", () => {
    const { state, headline } = classifyBrief({
      recipientName: "Eleanor",
      entries: [entry({ occurred_at: "2026-04-29T03:00:00Z", mood: "crisis" })],
    });
    expect(state).toBe("crisis");
    expect(joinHeadline(headline)).toContain("Eleanor");
    expect(emphasized(headline)).toEqual(["crisis moment"]);
  });

  it("classifies multiple crises as crisis (plural)", () => {
    const { state, headline } = classifyBrief({
      recipientName: "Eleanor",
      entries: [
        entry({ occurred_at: "2026-04-29T03:00:00Z", mood: "crisis" }),
        entry({ occurred_at: "2026-04-28T22:00:00Z", mood: "crisis" }),
      ],
    });
    expect(state).toBe("crisis");
    expect(joinHeadline(headline)).toContain("2");
    expect(emphasized(headline)).toEqual(["hard stretch"]);
  });

  it("classifies flagged-but-not-crisis entries as flagged", () => {
    const { state, headline } = classifyBrief({
      recipientName: "Eleanor",
      entries: [
        entry({
          occurred_at: "2026-04-29T03:00:00Z",
          flagged: true,
          mood: "okay",
        }),
        entry({
          occurred_at: "2026-04-28T22:00:00Z",
          flagged: false,
          mood: "good",
        }),
      ],
    });
    expect(state).toBe("flagged");
    expect(joinHeadline(headline)).toMatch(/worth a/i);
    expect(emphasized(headline)).toContain("second look");
  });

  it("classifies multiple difficult-mood entries as difficult_run", () => {
    const { state, headline } = classifyBrief({
      recipientName: "Eleanor",
      entries: [
        entry({ occurred_at: "2026-04-29T03:00:00Z", mood: "difficult" }),
        entry({ occurred_at: "2026-04-28T03:00:00Z", mood: "difficult" }),
        entry({ occurred_at: "2026-04-27T03:00:00Z", mood: "okay" }),
      ],
    });
    expect(state).toBe("difficult_run");
    expect(joinHeadline(headline)).toContain("Eleanor");
    expect(emphasized(headline)).toEqual(["rough", "difficult"]);
  });

  it("classifies a single non-difficult entry as single_entry", () => {
    const { state, headline } = classifyBrief({
      recipientName: "Eleanor",
      entries: [entry({ occurred_at: "2026-04-29T03:00:00Z", mood: "okay" })],
    });
    expect(state).toBe("single_entry");
    expect(emphasized(headline)).toEqual(["Quiet"]);
  });

  it("classifies a single difficult entry as single_entry with difficult emphasis", () => {
    const { state, headline } = classifyBrief({
      recipientName: "Eleanor",
      entries: [
        entry({ occurred_at: "2026-04-29T03:00:00Z", mood: "difficult" }),
      ],
    });
    expect(state).toBe("single_entry");
    expect(emphasized(headline)).toEqual(["difficult"]);
  });

  it("classifies all-good/okay entries as quiet_stable", () => {
    const { state, headline } = classifyBrief({
      recipientName: "Eleanor",
      entries: [
        entry({ occurred_at: "2026-04-29T03:00:00Z", mood: "good" }),
        entry({ occurred_at: "2026-04-28T03:00:00Z", mood: "okay" }),
        entry({ occurred_at: "2026-04-27T03:00:00Z", mood: "good" }),
      ],
    });
    expect(state).toBe("quiet_stable");
    expect(emphasized(headline)).toEqual(["steady", "notes"]);
  });

  it("uses only the first name in the headline (Eleanor Smith → Eleanor)", () => {
    const { headline } = classifyBrief({
      recipientName: "Eleanor Smith",
      entries: [entry({ occurred_at: "2026-04-29T03:00:00Z", mood: "good" })],
    });
    expect(joinHeadline(headline)).toContain("Eleanor");
    expect(joinHeadline(headline)).not.toContain("Smith");
  });
});

describe("parseStoredHeadline", () => {
  it("parses a valid Span[]", () => {
    const result = parseStoredHeadline([
      { text: "Mom slept " },
      { text: "poorly", em: true },
      { text: "." },
    ]);
    expect(result).toHaveLength(3);
    expect(result?.[1]).toEqual({ text: "poorly", em: true });
  });

  it("returns null for null/undefined/empty", () => {
    expect(parseStoredHeadline(null)).toBeNull();
    expect(parseStoredHeadline(undefined)).toBeNull();
    expect(parseStoredHeadline([])).toBeNull();
  });

  it("returns null when any span is missing text", () => {
    expect(parseStoredHeadline([{ em: true }])).toBeNull();
    expect(parseStoredHeadline([{ text: "ok" }, { foo: "bar" }])).toBeNull();
  });

  it("returns null when em is non-boolean", () => {
    expect(
      parseStoredHeadline([{ text: "x", em: "yes" as unknown as boolean }]),
    ).toBeNull();
  });

  it("strips em: false to keep storage tight", () => {
    const result = parseStoredHeadline([{ text: "ok", em: false }]);
    expect(result).toEqual([{ text: "ok" }]);
  });
});
