import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { BriefHero } from "../BriefHero";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

describe("BriefHero — structure", () => {
  it("renders the mono eyebrow label with auto-generated timestamp", () => {
    render(<BriefHero />);
    expect(
      screen.getByText(/Today's brief · auto-generated/i),
    ).toBeInTheDocument();
  });

  it("eyebrow uses the .eyebrow-mono utility class", () => {
    render(<BriefHero />);
    const eyebrow = screen.getByTestId("brief-eyebrow");
    expect(eyebrow.className).toContain("eyebrow-mono");
  });

  it("headline uses the .headline-display utility class (Fraunces adoption)", () => {
    render(<BriefHero />);
    const headline = screen.getByTestId("brief-headline");
    expect(headline.className).toContain("headline-display");
  });

  it("headline contains an <em> for load-bearing italic emphasis", () => {
    render(<BriefHero />);
    const headline = screen.getByTestId("brief-headline");
    expect(headline.querySelector("em")).not.toBeNull();
  });

  it("renders a primary-subtle blurred decorative blob", () => {
    render(<BriefHero />);
    const blob = screen.getByTestId("brief-blob");
    expect(blob.className).toContain("bg-[var(--color-primary-subtle)]");
    expect(blob.className).toContain("blur");
    expect(blob.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders at least 3 status pills in a row", () => {
    render(<BriefHero />);
    const pills = screen.getAllByTestId("brief-status-pill");
    expect(pills.length).toBeGreaterThanOrEqual(3);
  });

  it("status pills row surfaces meds, mood, and appointments labels", () => {
    render(<BriefHero />);
    const pills = screen.getAllByTestId("brief-status-pill");
    const joined = pills.map((p) => p.textContent?.toLowerCase()).join(" ");
    expect(joined).toMatch(/med/);
    expect(joined).toMatch(/mood/);
    expect(joined).toMatch(/appt|appointment/);
  });
});

describe("BriefHero — accessibility", () => {
  it("is a labeled region", () => {
    render(<BriefHero />);
    expect(
      screen.getByRole("region", { name: /today's brief/i }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<BriefHero />);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});
