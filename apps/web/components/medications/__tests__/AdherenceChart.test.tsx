import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdherenceChart, type AdherenceDay } from "../AdherenceChart";

const week: AdherenceDay[] = [
  { date: "2026-04-24", weekday: "Fri", taken: 3, expected: 3 }, // 100
  { date: "2026-04-25", weekday: "Sat", taken: 2, expected: 3 }, // 67
  { date: "2026-04-26", weekday: "Sun", taken: 1, expected: 3 }, // 33
  { date: "2026-04-27", weekday: "Mon", taken: 0, expected: 0 }, // n/a
  { date: "2026-04-28", weekday: "Tue", taken: 3, expected: 3 }, // 100
  { date: "2026-04-29", weekday: "Wed", taken: 3, expected: 3 }, // 100
  { date: "2026-04-30", weekday: "Thu", taken: 2, expected: 3 }, // 67
];

describe("<AdherenceChart />", () => {
  it("renders an empty-state when no days are provided", () => {
    render(<AdherenceChart days={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(/no adherence/i);
  });

  it("renders one day cell per day with a percent label on the heading", () => {
    render(<AdherenceChart days={week} />);
    const days = screen.getAllByTestId("adherence-day");
    expect(days).toHaveLength(7);
    // overall = 14/18 = 78%
    expect(screen.getByTestId("adherence-overall")).toHaveTextContent("78%");
  });

  it("computes per-day pct rounded to integer", () => {
    render(<AdherenceChart days={week.slice(0, 3)} />);
    const days = screen.getAllByTestId("adherence-day");
    expect(days[0]).toHaveAttribute("data-pct", "100");
    expect(days[1]).toHaveAttribute("data-pct", "67");
    expect(days[2]).toHaveAttribute("data-pct", "33");
  });

  it("treats expected=0 as n/a and renders no fill", () => {
    render(<AdherenceChart days={[week[3]!]} />);
    const day = screen.getByTestId("adherence-day");
    expect(day).toHaveAttribute("data-pct", "n/a");
    const fill = screen.getByTestId("adherence-day-fill");
    expect(fill).toHaveStyle({ height: "0%" });
  });

  it("clamps taken > expected to 100% (no overflow)", () => {
    render(
      <AdherenceChart
        days={[{ date: "x", weekday: "Mon", taken: 9, expected: 3 }]}
      />,
    );
    const day = screen.getByTestId("adherence-day");
    expect(day).toHaveAttribute("data-pct", "100");
  });

  it("each day cell announces taken/expected via aria-label", () => {
    render(<AdherenceChart days={week.slice(1, 2)} />);
    expect(
      screen.getByLabelText("Sat: 2 of 3 doses (67%)"),
    ).toBeInTheDocument();
  });

  it("color thresholds: ≥80 success, ≥50 secondary, <50 danger", () => {
    render(
      <AdherenceChart
        days={[
          { date: "1", weekday: "Mon", taken: 4, expected: 5 }, // 80 → success
          { date: "2", weekday: "Tue", taken: 3, expected: 5 }, // 60 → secondary
          { date: "3", weekday: "Wed", taken: 1, expected: 5 }, // 20 → danger
        ]}
      />,
    );
    const fills = screen.getAllByTestId("adherence-day-fill");
    expect(fills[0]).toHaveAttribute("data-color", "var(--color-success)");
    expect(fills[1]).toHaveAttribute("data-color", "var(--color-secondary)");
    expect(fills[2]).toHaveAttribute("data-color", "var(--color-danger)");
  });
});
