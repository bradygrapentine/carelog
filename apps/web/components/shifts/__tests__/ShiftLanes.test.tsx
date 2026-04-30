import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShiftLanes } from "../ShiftLanes";

const days = [
  "Mon 27",
  "Tue 28",
  "Wed 29",
  "Thu 30",
  "Fri 1",
  "Sat 2",
  "Sun 3",
];
const bands = ["Day 8a–2p", "Aft 2p–6p", "Eve 6p–10p", "Night 10p–8a"];
const assignments = [
  ["Anna", "Anna", "Anna", "Anna", "Anna", "David", "You"],
  ["Maria", "Maria", "Maria", null, "Maria", "Maria", null],
  ["Anna", "Anna", "Anna", "Anna", "Anna", "David", "David"],
  ["Sarah", "Sarah", "Sarah", "David", "Sarah", "Sarah", "Sarah"],
];

describe("<ShiftLanes />", () => {
  it("renders a grid with the right cell count (4 bands × 7 days)", () => {
    render(
      <ShiftLanes
        days={days}
        bands={bands}
        assignments={assignments}
        todayIndex={2}
        liveBandIndex={0}
      />,
    );
    expect(screen.getAllByRole("gridcell")).toHaveLength(28);
  });

  it("highlights today's column header", () => {
    render(
      <ShiftLanes
        days={days}
        bands={bands}
        assignments={assignments}
        todayIndex={2}
        liveBandIndex={0}
      />,
    );
    const todayHeader = screen.getByTestId("day-header-2");
    expect(todayHeader).toHaveAttribute("data-today", "true");
    const otherHeader = screen.getByTestId("day-header-3");
    expect(otherHeader).not.toHaveAttribute("data-today");
  });

  it("marks the live-now cell with data-state=live", () => {
    render(
      <ShiftLanes
        days={days}
        bands={bands}
        assignments={assignments}
        todayIndex={2}
        liveBandIndex={0}
      />,
    );
    expect(screen.getByTestId("cell-0-2")).toHaveAttribute(
      "data-state",
      "live",
    );
    expect(screen.getByTestId("cell-1-2")).toHaveAttribute(
      "data-state",
      "assigned",
    );
  });

  it("renders open shifts with data-state=open and a cover affordance", () => {
    render(
      <ShiftLanes
        days={days}
        bands={bands}
        assignments={assignments}
        todayIndex={2}
        liveBandIndex={0}
      />,
    );
    const openCell = screen.getByTestId("cell-1-3");
    expect(openCell).toHaveAttribute("data-state", "open");
    expect(openCell).toHaveTextContent(/open · cover/i);
  });

  it("attaches an aria-label to each open cell mentioning day + band", () => {
    render(
      <ShiftLanes
        days={days}
        bands={bands}
        assignments={assignments}
        todayIndex={2}
        liveBandIndex={0}
      />,
    );
    expect(
      screen.getByLabelText("Open shift on Thu 30, Aft 2p–6p"),
    ).toBeInTheDocument();
  });

  it("renders without errors when todayIndex is out of range", () => {
    render(
      <ShiftLanes
        days={days}
        bands={bands}
        assignments={assignments}
        todayIndex={-1}
        liveBandIndex={-1}
      />,
    );
    const headers = days.map((_, i) => screen.getByTestId(`day-header-${i}`));
    for (const h of headers) {
      expect(h).not.toHaveAttribute("data-today");
    }
  });
});
