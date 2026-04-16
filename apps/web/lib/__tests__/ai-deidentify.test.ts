import { describe, it, expect } from "vitest";
import { deidentifyName, buildNameMap, deidentifyText } from "../ai-deidentify";

describe("deidentifyName", () => {
  it("replaces a known name with its token", () => {
    const map = new Map([["Grandma Rose", "care recipient"]]);
    expect(deidentifyName("Grandma Rose", map)).toBe("care recipient");
  });

  it("returns the original string when name not in map", () => {
    const map = new Map<string, string>();
    expect(deidentifyName("Rose", map)).toBe("Rose");
  });
});

describe("buildNameMap", () => {
  it("maps care recipient name to 'care recipient'", () => {
    const map = buildNameMap("Grandma Rose", ["Sarah M.", "Tom K."]);
    expect(map.get("Grandma Rose")).toBe("care recipient");
  });

  it("maps team members to numbered tokens", () => {
    const map = buildNameMap("Grandma Rose", ["Sarah M.", "Tom K."]);
    expect(map.get("Sarah M.")).toBe("team member 1");
    expect(map.get("Tom K.")).toBe("team member 2");
  });
});

describe("deidentifyText", () => {
  it("replaces all known names in a text string", () => {
    const map = new Map([
      ["Grandma Rose", "care recipient"],
      ["Sarah M.", "team member 1"],
    ]);
    const result = deidentifyText(
      "Grandma Rose had a hard night. Sarah M. logged it.",
      map,
    );
    expect(result).toBe(
      "care recipient had a hard night. team member 1 logged it.",
    );
  });
});
