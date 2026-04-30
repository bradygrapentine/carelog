import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MedScheduleStrip, type StripDose } from "../MedScheduleStrip";

const sample: StripDose[] = [
  { id: "a", time: "07:00", label: "Levothyroxine 50mcg", state: "done" },
  { id: "b", time: "08:00", label: "Lisinopril 5mg", state: "done" },
  { id: "c", time: "21:00", label: "Donepezil 10mg", state: "upcoming" },
  { id: "d", time: "prn", label: "Lorazepam 0.5mg", state: "prn" },
];

describe("<MedScheduleStrip />", () => {
  it("renders the track and now marker", () => {
    render(<MedScheduleStrip doses={sample} now={9.5} />);
    expect(screen.getByTestId("med-schedule-strip-track")).toBeInTheDocument();
    expect(screen.getByTestId("med-schedule-strip-now")).toHaveStyle({
      left: `${(9.5 / 24) * 100}%`,
    });
  });

  it("positions each dot horizontally by its hour", () => {
    render(<MedScheduleStrip doses={sample} now={12} />);
    const dots = screen.getAllByTestId("med-schedule-dot");
    expect(dots).toHaveLength(3); // PRN does not get a dot
    const labels = dots.map((d) => d.getAttribute("aria-label"));
    expect(labels).toEqual(
      expect.arrayContaining([
        "Levothyroxine 50mcg at 07:00 — done",
        "Lisinopril 5mg at 08:00 — done",
        "Donepezil 10mg at 21:00 — upcoming",
      ]),
    );
    const seven = dots.find((d) =>
      d.getAttribute("aria-label")?.includes("07:00"),
    );
    expect(seven).toHaveStyle({ left: `${(7 / 24) * 100}%` });
  });

  it("clamps the now marker into 0–24", () => {
    const { rerender } = render(<MedScheduleStrip doses={[]} now={-3} />);
    expect(screen.getByTestId("med-schedule-strip-now")).toHaveStyle({
      left: "0%",
    });
    rerender(<MedScheduleStrip doses={[]} now={42} />);
    expect(screen.getByTestId("med-schedule-strip-now")).toHaveStyle({
      left: "100%",
    });
  });

  it("renders PRN doses as off-timeline pills", () => {
    render(<MedScheduleStrip doses={sample} now={12} />);
    const list = screen.getByLabelText("As-needed doses");
    expect(within(list).getByText("Lorazepam 0.5mg")).toBeInTheDocument();
  });

  it("ignores invalid time strings (no dot, no crash)", () => {
    render(
      <MedScheduleStrip
        doses={[
          { id: "x", time: "not-a-time", label: "Bad", state: "due" },
          { id: "y", time: "27:99", label: "Also bad", state: "due" },
        ]}
        now={12}
      />,
    );
    expect(screen.queryAllByTestId("med-schedule-dot")).toHaveLength(0);
  });

  it("applies a state-specific class per dose", () => {
    render(<MedScheduleStrip doses={sample} now={12} />);
    const dots = screen.getAllByTestId("med-schedule-dot");
    const states = dots.map((d) => d.getAttribute("data-state"));
    expect(states).toEqual(expect.arrayContaining(["done", "upcoming"]));
  });
});
