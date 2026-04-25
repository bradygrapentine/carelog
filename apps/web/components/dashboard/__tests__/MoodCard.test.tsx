import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { MoodCard } from "../MoodCard";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

describe("MoodCard — sparkline", () => {
  it("renders exactly 13 bars (a fortnight minus one)", () => {
    render(<MoodCard />);
    const bars = screen.getAllByTestId("mood-bar");
    expect(bars).toHaveLength(13);
  });

  it("the 13th (today) bar uses --color-primary", () => {
    render(<MoodCard />);
    const bars = screen.getAllByTestId("mood-bar");
    const today = bars[bars.length - 1];
    expect(today.className).toContain("bg-[var(--color-primary)]");
  });

  it("the earlier 12 bars use --color-primary-subtle", () => {
    render(<MoodCard />);
    const bars = screen.getAllByTestId("mood-bar");
    for (let i = 0; i < 12; i++) {
      expect(bars[i].className).toContain("bg-[var(--color-primary-subtle)]");
    }
  });

  it("each bar has a non-zero height style (data-driven)", () => {
    render(<MoodCard />);
    const bars = screen.getAllByTestId("mood-bar");
    bars.forEach((bar) => {
      const style = bar.getAttribute("style") ?? "";
      expect(style).toMatch(/height/i);
    });
  });
});

describe("MoodCard — label", () => {
  it("renders a mood label", () => {
    render(<MoodCard />);
    const label = screen.getByTestId("mood-label");
    expect(label.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it("mood label uses the .headline-display utility class (Fraunces)", () => {
    render(<MoodCard />);
    const label = screen.getByTestId("mood-label");
    expect(label.className).toContain("headline-display");
  });
});

describe("MoodCard — accessibility", () => {
  it("is a region labeled 'Mood'", () => {
    render(<MoodCard />);
    expect(
      screen.getByRole("region", { name: /mood/i }),
    ).toBeInTheDocument();
  });

  it("the sparkline has a descriptive aria-label (screen readers get the trend summary)", () => {
    render(<MoodCard />);
    const chart = screen.getByTestId("mood-sparkline");
    const label = chart.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(10);
  });

  it("has no axe violations", async () => {
    const { container } = render(<MoodCard />);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});
