import { describe, expect, it } from "vitest";
import { pluralize, pluralWord } from "../pluralize";

describe("pluralize", () => {
  it("returns singular for count of 1", () => {
    expect(pluralize(1, "entry", "entries")).toBe("1 entry");
    expect(pluralize(1, "dose")).toBe("1 dose");
  });

  it("returns plural for count of 0, 2, and large numbers", () => {
    expect(pluralize(0, "entry", "entries")).toBe("0 entries");
    expect(pluralize(2, "entry", "entries")).toBe("2 entries");
    expect(pluralize(42, "entry", "entries")).toBe("42 entries");
  });

  it("falls back to appending 's' when plural is omitted", () => {
    expect(pluralize(0, "dose")).toBe("0 doses");
    expect(pluralize(1, "dose")).toBe("1 dose");
    expect(pluralize(7, "dose")).toBe("7 doses");
  });

  it("treats -1 as singular per Intl.PluralRules en-US", () => {
    // Intl.PluralRules considers -1 a "one" form in en-US. Documenting that
    // here so any future call site can rely on the behaviour rather than
    // discovering it the hard way.
    expect(pluralize(-1, "entry", "entries")).toBe("-1 entry");
  });

  it("respects an alternate locale (en-GB → same rule)", () => {
    expect(pluralize(2, "colour", "colours", "en-GB")).toBe("2 colours");
  });

  it("pluralWord returns just the word", () => {
    expect(pluralWord(1, "entry", "entries")).toBe("entry");
    expect(pluralWord(0, "entry", "entries")).toBe("entries");
    expect(pluralWord(2, "dose")).toBe("doses");
  });
});
