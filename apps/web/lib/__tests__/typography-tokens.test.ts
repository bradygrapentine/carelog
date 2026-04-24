/**
 * Smoke test: verifies the UX-16 typography token names and utility class
 * names are present in globals.css. Catches accidental removals during future
 * merges — the implementation lives in the CSS, not here.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const globalsPath = join(__dirname, "../../app/globals.css");
const css = readFileSync(globalsPath, "utf8");

describe("UX-16 typography tokens", () => {
  it("exposes --font-display token", () => {
    expect(css).toContain("--font-display");
  });

  it("exposes --font-body token", () => {
    expect(css).toContain("--font-body");
  });

  it("exposes --font-mono token", () => {
    expect(css).toContain("--font-mono");
  });
});

describe("UX-16 editorial utility classes", () => {
  it("defines .headline-display class", () => {
    expect(css).toContain(".headline-display");
  });

  it("defines .headline-display em scoped rule (NOT a global em rule)", () => {
    expect(css).toContain(".headline-display em");
    // Ensure there is NO bare global `em {` rule
    const globalEmMatch = css.match(/^\s*em\s*\{/m);
    expect(globalEmMatch).toBeNull();
  });

  it("defines .eyebrow-mono class", () => {
    expect(css).toContain(".eyebrow-mono");
  });
});
