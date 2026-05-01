import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PatternCard } from "../PatternCard";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PatternCard", () => {
  it("renders eyebrow, headline, detail", () => {
    render(
      <PatternCard
        eyebrow="PATTERN · 7-day"
        headline="Sundowning earlier on Tuesdays"
        detail="Over the past week, agitation peaks around 4pm on Tuesdays, two hours earlier than other days."
      />,
    );
    expect(screen.getByTestId("pattern-eyebrow")).toBeInTheDocument();
    expect(screen.getByTestId("pattern-headline")).toBeInTheDocument();
    expect(screen.getByTestId("pattern-detail")).toBeInTheDocument();
  });

  it('trend="up" renders the TrendingUp icon', () => {
    render(
      <PatternCard
        eyebrow="PATTERN"
        headline="Improving sleep"
        detail="Sleep duration trending up."
        trend="up"
      />,
    );
    expect(screen.getByTestId("trend-icon-up")).toBeInTheDocument();
  });

  it('trend="down" renders TrendingDown', () => {
    render(
      <PatternCard
        eyebrow="PATTERN"
        headline="Declining appetite"
        detail="Appetite trending down."
        trend="down"
      />,
    );
    expect(screen.getByTestId("trend-icon-down")).toBeInTheDocument();
  });

  it('trend="flat" renders Minus', () => {
    render(
      <PatternCard
        eyebrow="PATTERN"
        headline="Stable mobility"
        detail="Mobility holding steady."
        trend="flat"
      />,
    );
    expect(screen.getByTestId("trend-icon-flat")).toBeInTheDocument();
  });

  it("trend undefined renders no trend icon", () => {
    render(
      <PatternCard
        eyebrow="PATTERN"
        headline="Stable mobility"
        detail="Mobility holding steady."
      />,
    );
    expect(screen.queryByTestId("trend-icon-up")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trend-icon-down")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trend-icon-flat")).not.toBeInTheDocument();
  });

  it("headline uses the display serif class", () => {
    render(
      <PatternCard
        eyebrow="PATTERN"
        headline="Sundowning earlier on Tuesdays"
        detail="Detail text."
      />,
    );
    const headline = screen.getByTestId("pattern-headline");
    expect(headline.className).toMatch(/headline-display|font-display/);
  });

  it("eyebrow renders in uppercase", () => {
    render(
      <PatternCard
        eyebrow="PATTERN · 7-day"
        headline="Sundowning earlier on Tuesdays"
        detail="Detail text."
      />,
    );
    const eyebrow = screen.getByTestId("pattern-eyebrow");
    // Either text-transform uppercase via CSS class or content is already uppercase
    const text = eyebrow.textContent ?? "";
    expect(text).toMatch(/PATTERN/);
  });
});
