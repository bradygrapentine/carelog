import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MedStatusBadge } from "../MedStatusBadge";

describe("<MedStatusBadge />", () => {
  it("status='on-track' renders text 'On track'", () => {
    render(<MedStatusBadge status="on-track" />);
    expect(screen.getByText("On track")).toBeInTheDocument();
  });

  it("status='catch-up' renders text 'Catch up'", () => {
    render(<MedStatusBadge status="catch-up" />);
    expect(screen.getByText("Catch up")).toBeInTheDocument();
  });

  it("status='missed' renders text 'Missed'", () => {
    render(<MedStatusBadge status="missed" />);
    expect(screen.getByText("Missed")).toBeInTheDocument();
  });

  it("each status produces a different className", () => {
    const { rerender, container } = render(<MedStatusBadge status="on-track" />);
    const onTrackClass = container.firstElementChild?.className ?? "";

    rerender(<MedStatusBadge status="catch-up" />);
    const catchUpClass = container.firstElementChild?.className ?? "";

    rerender(<MedStatusBadge status="missed" />);
    const missedClass = container.firstElementChild?.className ?? "";

    expect(onTrackClass).not.toBe(catchUpClass);
    expect(onTrackClass).not.toBe(missedClass);
    expect(catchUpClass).not.toBe(missedClass);
  });

  it("merges a custom className", () => {
    render(<MedStatusBadge status="on-track" className="custom-class" />);
    const el = screen.getByText("On track");
    expect(el.className).toContain("custom-class");
  });
});
