import { describe, it, expect } from "vitest";
import { formatContextBlob } from "../ai-context";

describe("formatContextBlob", () => {
  it("returns a non-empty string", () => {
    const blob = formatContextBlob("dashboard", {
      recentMoodScores: ["good", "difficult"],
      activeMedCount: 3,
      unreadMessageCount: 2,
      nameMap: new Map([["Grandma Rose", "care recipient"]]),
    });
    expect(typeof blob).toBe("string");
    expect(blob.length).toBeGreaterThan(10);
  });

  it("does not include original names", () => {
    const blob = formatContextBlob("medications", {
      recentMoodScores: [],
      activeMedCount: 2,
      unreadMessageCount: 0,
      nameMap: new Map([["Grandma Rose", "care recipient"]]),
    });
    expect(blob).not.toContain("Grandma Rose");
    expect(blob).toContain("care recipient");
  });
});
