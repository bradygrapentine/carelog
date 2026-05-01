import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyMoodBars } from "../WeeklyMoodBars";

describe("WeeklyMoodBars", () => {
  it("renders one bar per mood bucket with count labels", () => {
    render(
      <WeeklyMoodBars
        counts={[
          { mood: "good", count: 4 },
          { mood: "steady", count: 2 },
          { mood: "difficult", count: 1 },
        ]}
      />,
    );
    expect(screen.getByTestId("mood-bar-good")).toBeInTheDocument();
    expect(screen.getByTestId("mood-bar-steady")).toBeInTheDocument();
    expect(screen.getByTestId("mood-bar-difficult")).toBeInTheDocument();
  });

  it("each bar row carries an aria-label including mood name and count", () => {
    render(<WeeklyMoodBars counts={[{ mood: "good", count: 3 }]} />);
    expect(screen.getByLabelText(/mood good: 3 entries/i)).toBeInTheDocument();
  });

  it("uses singular 'entry' for count of 1", () => {
    render(<WeeklyMoodBars counts={[{ mood: "difficult", count: 1 }]} />);
    expect(
      screen.getByLabelText(/mood difficult: 1 entry/i),
    ).toBeInTheDocument();
  });

  it("colors each bar with its mood token", () => {
    render(
      <WeeklyMoodBars
        counts={[
          { mood: "good", count: 2 },
          { mood: "difficult", count: 2 },
        ]}
      />,
    );
    const goodStyle = screen.getByTestId("mood-bar-good").getAttribute("style");
    const diffStyle = screen
      .getByTestId("mood-bar-difficult")
      .getAttribute("style");
    expect(goodStyle).toContain("--color-mood-good");
    expect(diffStyle).toContain("--color-mood-difficult");
    expect(goodStyle).not.toEqual(diffStyle);
  });

  it("renders top tags when provided", () => {
    render(
      <WeeklyMoodBars
        counts={[{ mood: "good", count: 1 }]}
        topTags={[
          { tag: "appetite", count: 3 },
          { tag: "sleep", count: 2 },
        ]}
      />,
    );
    expect(screen.getByText(/appetite/i)).toBeInTheDocument();
    expect(screen.getByText(/sleep/i)).toBeInTheDocument();
  });

  it("omits the tags section when topTags is empty or undefined", () => {
    render(<WeeklyMoodBars counts={[{ mood: "good", count: 1 }]} />);
    expect(screen.queryByText(/top tags/i)).not.toBeInTheDocument();
  });

  it("renders empty state when no counts and no tags", () => {
    render(<WeeklyMoodBars counts={[]} />);
    expect(screen.getByText(/not enough entries yet/i)).toBeInTheDocument();
  });

  it("wrapper has role=figure and the chart aria-label", () => {
    render(<WeeklyMoodBars counts={[{ mood: "good", count: 1 }]} />);
    expect(
      screen.getByRole("figure", { name: /weekly mood distribution/i }),
    ).toBeInTheDocument();
  });
});
