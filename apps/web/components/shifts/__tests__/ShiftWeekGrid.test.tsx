import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShiftWeekGrid } from "../ShiftWeekGrid";
import type { ShiftBlock } from "../ShiftWeekGrid";

const blocks: ShiftBlock[] = [
  {
    id: "b1",
    caregiverId: "c1",
    caregiverName: "Alice",
    day: 0,
    startHour: 8,
    endHour: 16,
  },
  {
    id: "b2",
    caregiverId: "c2",
    caregiverName: "Bob",
    day: 3,
    startHour: 16,
    endHour: 20,
  },
];

describe("<ShiftWeekGrid />", () => {
  it("renders 7 day-label headers (Mon..Sun)", () => {
    render(<ShiftWeekGrid blocks={blocks} />);
    const defaults = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (const label of defaults) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders one hour label per row in the configured range", () => {
    render(<ShiftWeekGrid blocks={blocks} startHour={8} endHour={10} />);
    // Rows for 8 and 9 (8 to 10 exclusive)
    expect(screen.getByText(/8:00/)).toBeInTheDocument();
    expect(screen.getByText(/9:00/)).toBeInTheDocument();
  });

  it("renders one block per blocks entry with the caregiver name visible", () => {
    render(<ShiftWeekGrid blocks={blocks} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("each block has an aria-label including caregiver name + day + start/end", () => {
    render(<ShiftWeekGrid blocks={blocks} />);
    expect(
      screen.getByLabelText(/Alice.*Mon.*8:00.*16:00/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Bob.*Thu.*16:00.*20:00/i),
    ).toBeInTheDocument();
  });

  it("empty blocks renders the empty fallback", () => {
    render(<ShiftWeekGrid blocks={[]} />);
    expect(
      screen.getByText(/No shifts scheduled this week/i),
    ).toBeInTheDocument();
  });

  it("uses role='grid' on the wrapper", () => {
    render(<ShiftWeekGrid blocks={blocks} />);
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});
