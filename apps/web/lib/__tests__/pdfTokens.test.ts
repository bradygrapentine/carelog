import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pdfTokens } from "../pdfTokens";

const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

// Each `it` asserts one matched token mirrors its CSS custom property in
// globals.css. Drift entries (`*Legacy`) are intentionally NOT asserted —
// they are documented in pdfTokens.ts and have no canonical source.
describe("pdfTokens parity with globals.css @theme inline block", () => {
  it("ink matches --color-ink", () => {
    expect(css).toContain(`--color-ink:`);
    expect(css).toMatch(
      new RegExp(`--color-ink:\\s*${pdfTokens.ink}`),
    );
  });

  it("muted matches --color-muted", () => {
    expect(css).toMatch(
      new RegExp(`--color-muted:\\s*${pdfTokens.muted}`),
    );
  });

  it("border matches --color-border", () => {
    expect(css).toMatch(
      new RegExp(`--color-border:\\s*${pdfTokens.border}`),
    );
  });

  it("danger matches --color-danger", () => {
    expect(css).toMatch(
      new RegExp(`--color-danger:\\s*${pdfTokens.danger}`),
    );
  });

  it("neutral100 matches --color-neutral-100", () => {
    expect(css).toMatch(
      new RegExp(`--color-neutral-100:\\s*${pdfTokens.neutral100}`),
    );
  });

  it("neutral200 matches --color-neutral-200", () => {
    expect(css).toMatch(
      new RegExp(`--color-neutral-200:\\s*${pdfTokens.neutral200}`),
    );
  });

  it("neutral400 matches --color-neutral-400", () => {
    expect(css).toMatch(
      new RegExp(`--color-neutral-400:\\s*${pdfTokens.neutral400}`),
    );
  });

  it("neutral700 matches --color-neutral-700", () => {
    expect(css).toMatch(
      new RegExp(`--color-neutral-700:\\s*${pdfTokens.neutral700}`),
    );
  });
});
