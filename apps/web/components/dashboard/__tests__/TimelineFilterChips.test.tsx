import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimelineFilterChips } from "../TimelineFilterChips";
import type { ChipOption } from "../TimelineFilterChips";

const OPTIONS: ChipOption[] = [
  { id: "med", label: "Medications" },
  { id: "journal", label: "Journal" },
  { id: "vital", label: "Vitals" },
];

describe("TimelineFilterChips", () => {
  it("renders one chip per option", () => {
    render(
      <TimelineFilterChips
        options={OPTIONS}
        selected={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Medications")).toBeInTheDocument();
    expect(screen.getByText("Journal")).toBeInTheDocument();
    expect(screen.getByText("Vitals")).toBeInTheDocument();
  });

  it("selected option has aria-pressed='true'", () => {
    render(
      <TimelineFilterChips
        options={OPTIONS}
        selected={["med"]}
        onChange={() => {}}
      />,
    );
    const medBtn = screen.getByText("Medications").closest("button");
    expect(medBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("unselected option has aria-pressed='false'", () => {
    render(
      <TimelineFilterChips
        options={OPTIONS}
        selected={["med"]}
        onChange={() => {}}
      />,
    );
    const journalBtn = screen.getByText("Journal").closest("button");
    expect(journalBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking an unselected chip calls onChange with the option added", () => {
    const onChange = vi.fn();
    render(
      <TimelineFilterChips
        options={OPTIONS}
        selected={["med"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Journal"));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining(["med", "journal"]),
    );
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it("clicking a selected chip calls onChange with the option removed", () => {
    const onChange = vi.fn();
    render(
      <TimelineFilterChips
        options={OPTIONS}
        selected={["med", "journal"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Medications"));
    expect(onChange).toHaveBeenCalledWith(["journal"]);
  });

  it("uses fieldset semantic markup", () => {
    const { container } = render(
      <TimelineFilterChips
        options={OPTIONS}
        selected={[]}
        onChange={() => {}}
      />,
    );
    const fieldset = container.querySelector("fieldset");
    expect(fieldset).toBeInTheDocument();
  });

  it("chip buttons have a focus ring utility class", () => {
    const { container } = render(
      <TimelineFilterChips
        options={OPTIONS}
        selected={[]}
        onChange={() => {}}
      />,
    );
    const buttons = container.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect(btn.className).toMatch(/focus:/);
    });
  });
});
