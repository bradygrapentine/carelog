import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoodHeatmap } from "../MoodHeatmap";

// Pin "today" to a known date so the 35-day window is deterministic.
const TODAY = new Date(2026, 3, 30); // 2026-04-30 (local)

function dateNDaysAgo(n: number): Date {
  const d = new Date(TODAY);
  d.setDate(TODAY.getDate() - n);
  return d;
}

describe("MoodHeatmap — rendering", () => {
  it("renders exactly 35 cells (5 weeks × 7 days)", () => {
    render(<MoodHeatmap entries={[]} today={TODAY} />);
    const grid = screen.getByTestId("mood-heatmap-grid");
    expect(grid.children).toHaveLength(35);
  });

  it("shows the 'no entries' empty state when nothing is logged", () => {
    render(<MoodHeatmap entries={[]} today={TODAY} />);
    expect(screen.getByTestId("mood-heatmap-empty")).toBeInTheDocument();
  });

  it("hides the empty state once at least one mood is mapped", () => {
    render(
      <MoodHeatmap
        entries={[
          { created_at: dateNDaysAgo(1).toISOString(), mood: "good" },
        ]}
        today={TODAY}
      />,
    );
    expect(
      screen.queryByTestId("mood-heatmap-empty"),
    ).not.toBeInTheDocument();
  });
});

describe("MoodHeatmap — bucketing", () => {
  it("paints today's cell with the logged mood", () => {
    render(
      <MoodHeatmap
        entries={[{ created_at: TODAY.toISOString(), mood: "difficult" }]}
        today={TODAY}
      />,
    );
    const grid = screen.getByTestId("mood-heatmap-grid");
    // Index 34 = today (cells render oldest → newest).
    const todayCell = grid.children[34] as HTMLElement;
    expect(todayCell.dataset.mood).toBe("difficult");
  });

  it("worst mood wins when multiple entries land on the same day", () => {
    render(
      <MoodHeatmap
        entries={[
          { created_at: TODAY.toISOString(), mood: "good" },
          { created_at: TODAY.toISOString(), mood: "crisis" },
          { created_at: TODAY.toISOString(), mood: "okay" },
        ]}
        today={TODAY}
      />,
    );
    const grid = screen.getByTestId("mood-heatmap-grid");
    const todayCell = grid.children[34] as HTMLElement;
    expect(todayCell.dataset.mood).toBe("crisis");
  });

  it("ignores entries older than the 5-week window", () => {
    render(
      <MoodHeatmap
        entries={[{ created_at: dateNDaysAgo(60).toISOString(), mood: "good" }]}
        today={TODAY}
      />,
    );
    const grid = screen.getByTestId("mood-heatmap-grid");
    const filled = Array.from(grid.children).filter(
      (c) => (c as HTMLElement).dataset.mood !== "none",
    );
    expect(filled).toHaveLength(0);
  });

  it("ignores entries with invalid dates or unknown mood", () => {
    render(
      <MoodHeatmap
        entries={[
          { created_at: "not-a-date", mood: "good" },
          { created_at: TODAY.toISOString(), mood: "weird-mood" },
        ]}
        today={TODAY}
      />,
    );
    const grid = screen.getByTestId("mood-heatmap-grid");
    const filled = Array.from(grid.children).filter(
      (c) => (c as HTMLElement).dataset.mood !== "none",
    );
    expect(filled).toHaveLength(0);
  });
});

describe("MoodHeatmap — interaction & a11y", () => {
  it("each cell has an aria-label with date + mood", () => {
    render(
      <MoodHeatmap
        entries={[{ created_at: TODAY.toISOString(), mood: "good" }]}
        today={TODAY}
      />,
    );
    const grid = screen.getByTestId("mood-heatmap-grid");
    const todayCell = grid.children[34] as HTMLElement;
    expect(todayCell.getAttribute("aria-label")).toMatch(/good$/);
    const otherCell = grid.children[0] as HTMLElement;
    expect(otherCell.getAttribute("aria-label")).toMatch(/no entry$/);
  });

  it("renders cells as buttons (Tab-traversable) when onDayClick is provided", () => {
    const onClick = vi.fn();
    render(<MoodHeatmap entries={[]} today={TODAY} onDayClick={onClick} />);
    const grid = screen.getByTestId("mood-heatmap-grid");
    const buttons = grid.querySelectorAll("button");
    expect(buttons).toHaveLength(35);
    fireEvent.click(buttons[34]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders cells as static divs when onDayClick is not provided", () => {
    render(<MoodHeatmap entries={[]} today={TODAY} />);
    const grid = screen.getByTestId("mood-heatmap-grid");
    expect(grid.querySelectorAll("button")).toHaveLength(0);
  });

  it("grid has role=grid with an accessible name", () => {
    render(<MoodHeatmap entries={[]} today={TODAY} />);
    const grid = screen.getByRole("grid", { name: /Mood heatmap/i });
    expect(grid).toBeInTheDocument();
  });
});
