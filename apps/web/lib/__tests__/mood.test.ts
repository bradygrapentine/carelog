import { describe, it, expect } from "vitest";
import {
  moodDotClass,
  moodBorderClass,
  moodBgClass,
  moodChipClass,
  type Mood,
} from "../mood";

const MOODS: Mood[] = ["good", "okay", "difficult", "crisis"];

describe("moodDotClass", () => {
  it.each(MOODS)("returns the bg-token class for %s", (m) => {
    expect(moodDotClass(m)).toBe(`bg-[var(--color-mood-${m})]`);
  });
});

describe("moodBorderClass", () => {
  it.each(MOODS)("returns the border-l-token class for %s", (m) => {
    expect(moodBorderClass(m)).toBe(`border-l-[var(--color-mood-${m})]`);
  });
});

describe("moodBgClass (outline badge)", () => {
  it("uses 12%/35% tint for good", () => {
    expect(moodBgClass("good")).toBe(
      "bg-[color-mix(in_oklab,var(--color-mood-good)_12%,white)] text-[var(--color-mood-good)] border-[color-mix(in_oklab,var(--color-mood-good)_35%,white)]",
    );
  });

  it("uses 15%/40% tint for okay", () => {
    expect(moodBgClass("okay")).toBe(
      "bg-[color-mix(in_oklab,var(--color-mood-okay)_15%,white)] text-[var(--color-mood-okay)] border-[color-mix(in_oklab,var(--color-mood-okay)_40%,white)]",
    );
  });

  it("uses 15%/40% tint for difficult", () => {
    expect(moodBgClass("difficult")).toBe(
      "bg-[color-mix(in_oklab,var(--color-mood-difficult)_15%,white)] text-[var(--color-mood-difficult)] border-[color-mix(in_oklab,var(--color-mood-difficult)_40%,white)]",
    );
  });

  it("uses 15%/40% tint for crisis", () => {
    expect(moodBgClass("crisis")).toBe(
      "bg-[color-mix(in_oklab,var(--color-mood-crisis)_15%,white)] text-[var(--color-mood-crisis)] border-[color-mix(in_oklab,var(--color-mood-crisis)_40%,white)]",
    );
  });
});

describe("moodChipClass", () => {
  it("returns the resting outline-badge tint when selected is false/absent", () => {
    expect(moodChipClass("good")).toBe(moodBgClass("good"));
    expect(moodChipClass("okay", { selected: false })).toBe(moodBgClass("okay"));
  });

  it("uses 18%/45% tint for selected good", () => {
    expect(moodChipClass("good", { selected: true })).toBe(
      "bg-[color-mix(in_oklab,var(--color-mood-good)_18%,white)] text-[var(--color-mood-good)] border-[color-mix(in_oklab,var(--color-mood-good)_45%,white)]",
    );
  });

  it("uses 22%/50% tint for selected okay", () => {
    expect(moodChipClass("okay", { selected: true })).toBe(
      "bg-[color-mix(in_oklab,var(--color-mood-okay)_22%,white)] text-[var(--color-mood-okay)] border-[color-mix(in_oklab,var(--color-mood-okay)_50%,white)]",
    );
  });

  it("uses 22%/50% tint for selected difficult", () => {
    expect(moodChipClass("difficult", { selected: true })).toBe(
      "bg-[color-mix(in_oklab,var(--color-mood-difficult)_22%,white)] text-[var(--color-mood-difficult)] border-[color-mix(in_oklab,var(--color-mood-difficult)_50%,white)]",
    );
  });

  it("uses 22%/50% tint for selected crisis", () => {
    expect(moodChipClass("crisis", { selected: true })).toBe(
      "bg-[color-mix(in_oklab,var(--color-mood-crisis)_22%,white)] text-[var(--color-mood-crisis)] border-[color-mix(in_oklab,var(--color-mood-crisis)_50%,white)]",
    );
  });
});
