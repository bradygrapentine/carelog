import { describe, it, expect } from "vitest";
import { detectPhiSlip } from "./ai-phi-monitor";

describe("detectPhiSlip", () => {
  it("detects exact match: PHI key present in response → slipped=true", () => {
    const nameMap = new Map([["Margaret", "care recipient"]]);
    const result = detectPhiSlip(
      "Margaret took her medication today.",
      nameMap,
    );
    expect(result.slipped).toBe(true);
    expect(result.matchedKeys).toContain("Margaret");
  });

  it("detects case-insensitive match: lowercase key still triggers → slipped=true", () => {
    const nameMap = new Map([["Robert", "team member 1"]]);
    const result = detectPhiSlip(
      "robert helped with the morning shift.",
      nameMap,
    );
    expect(result.slipped).toBe(true);
    expect(result.matchedKeys).toContain("Robert");
  });

  it("word-boundary negative: 'Ann' does NOT match inside 'annoying' → slipped=false", () => {
    const nameMap = new Map([["Ann", "care recipient"]]);
    const result = detectPhiSlip(
      "The situation was annoying but manageable.",
      nameMap,
    );
    expect(result.slipped).toBe(false);
    expect(result.matchedKeys).toHaveLength(0);
  });

  it("no-slip: response contains only placeholders, no PHI keys → slipped=false", () => {
    const nameMap = new Map([
      ["Alice", "care recipient"],
      ["Bob", "team member 1"],
    ]);
    const result = detectPhiSlip(
      "Care recipient is stable. Team member 1 completed the check.",
      nameMap,
    );
    expect(result.slipped).toBe(false);
    expect(result.matchedKeys).toHaveLength(0);
  });

  it("skips keys shorter than 2 chars to avoid false positives", () => {
    const nameMap = new Map([["A", "care recipient"]]);
    const result = detectPhiSlip("A normal day for everyone.", nameMap);
    expect(result.slipped).toBe(false);
  });

  it("detects multiple PHI keys when several slip through", () => {
    const nameMap = new Map([
      ["Clara", "care recipient"],
      ["Derek", "team member 1"],
    ]);
    const result = detectPhiSlip(
      "Clara and Derek went to the appointment.",
      nameMap,
    );
    expect(result.slipped).toBe(true);
    expect(result.matchedKeys).toContain("Clara");
    expect(result.matchedKeys).toContain("Derek");
    expect(result.matchedKeys).toHaveLength(2);
  });
});
