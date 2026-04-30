import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoodSpectrum } from "../MoodSpectrum";

describe("MoodSpectrum — rendering", () => {
  it("renders four mood segments in order good→crisis", () => {
    render(<MoodSpectrum value="" onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(radios.map((r) => r.getAttribute("data-mood"))).toEqual([
      "good",
      "okay",
      "difficult",
      "crisis",
    ]);
  });

  it("group has aria-label 'Mood' by default", () => {
    render(<MoodSpectrum value="" onChange={vi.fn()} />);
    expect(
      screen.getByRole("radiogroup", { name: "Mood" }),
    ).toBeInTheDocument();
  });

  it("ariaLabel prop overrides the group label", () => {
    render(
      <MoodSpectrum value="" onChange={vi.fn()} ariaLabel="Today's mood" />,
    );
    expect(
      screen.getByRole("radiogroup", { name: "Today's mood" }),
    ).toBeInTheDocument();
  });
});

describe("MoodSpectrum — selection", () => {
  it("marks the active value with aria-checked=true", () => {
    render(<MoodSpectrum value="okay" onChange={vi.fn()} />);
    expect(
      screen.getByRole("radio", { name: "Okay" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("radio", { name: "Good" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("clicking a segment fires onChange with that mood key", () => {
    const onChange = vi.fn();
    render(<MoodSpectrum value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Difficult" }));
    expect(onChange).toHaveBeenCalledWith("difficult");
  });

  it("clicking the active segment clears the value (toggle off)", () => {
    const onChange = vi.fn();
    render(<MoodSpectrum value="good" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Good" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("MoodSpectrum — accessibility", () => {
  it("all segments are reachable via Tab (tabIndex !== -1)", () => {
    render(<MoodSpectrum value="" onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    radios.forEach((r) => {
      expect((r as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });

  it("group element exposes role=radiogroup with an accessible name", () => {
    render(<MoodSpectrum value="" onChange={vi.fn()} />);
    expect(
      screen.getByRole("radiogroup", { name: /Mood/i }),
    ).toBeInTheDocument();
  });
});
