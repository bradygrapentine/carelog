import { describe, it, expect } from "vitest";
import { getAllGuides, getGuideBySlug, getGuidesByTags } from "../education";

describe("getAllGuides", () => {
  it("returns an array of guides", () => {
    const guides = getAllGuides();
    expect(Array.isArray(guides)).toBe(true);
    expect(guides.length).toBeGreaterThan(0);
  });

  it("each guide has required frontmatter fields", () => {
    const guides = getAllGuides();
    for (const guide of guides) {
      expect(guide.slug).toBeTruthy();
      expect(guide.title).toBeTruthy();
      expect(guide.summary).toBeTruthy();
      expect(Array.isArray(guide.challenges)).toBe(true);
      expect(Array.isArray(guide.topics)).toBe(true);
      expect(Array.isArray(guide.tips)).toBe(true);
    }
  });
});

describe("getGuideBySlug", () => {
  it("returns the guide for a known slug", () => {
    const guide = getGuideBySlug("sundowning");
    expect(guide).toBeTruthy();
    expect(guide!.title).toBe("Managing Sundowning");
  });

  it("returns null for an unknown slug", () => {
    expect(getGuideBySlug("does-not-exist")).toBeNull();
  });
});

describe("getGuidesByTags", () => {
  it("returns guides matching challenge tags", () => {
    const guides = getGuidesByTags(["sundowning"]);
    expect(guides.length).toBeGreaterThan(0);
    expect(guides[0]!.slug).toBe("sundowning");
  });

  it("returns empty array when no guides match", () => {
    const guides = getGuidesByTags(["no-match-tag-xyz"]);
    expect(guides).toEqual([]);
  });

  it("sorts by overlap count descending", () => {
    const guides = getGuidesByTags(["caregiver-burnout", "caregiver-stress"]);
    expect(guides[0]!.slug).toBe("caregiver-burnout");
  });
});
