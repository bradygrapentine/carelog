import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShiftQuoteNote } from "../ShiftQuoteNote";

describe("ShiftQuoteNote", () => {
  it("renders the quote text in a blockquote", () => {
    render(
      <ShiftQuoteNote
        quote="She watched the cardinals for almost ten minutes."
        by="Sarah"
        when="yesterday, 7:42a"
      />,
    );
    const quote = screen.getByText(
      "She watched the cardinals for almost ten minutes.",
    );
    expect(quote.closest("blockquote")).not.toBeNull();
  });

  it("renders the byline and timestamp in the figcaption", () => {
    const { container } = render(
      <ShiftQuoteNote quote="x" by="Anna" when="Apr 27, 4:50p" />,
    );
    const caption = container.querySelector("figcaption");
    expect(caption?.textContent).toContain("Anna");
    expect(caption?.textContent).toContain("Apr 27, 4:50p");
  });

  it("uses a figure wrapper for semantic grouping of quote + caption", () => {
    const { container } = render(
      <ShiftQuoteNote quote="x" by="Anna" when="now" />,
    );
    expect(container.querySelector("figure")).not.toBeNull();
  });

  it("applies a left rule via border-l class", () => {
    const { container } = render(
      <ShiftQuoteNote quote="x" by="Anna" when="now" />,
    );
    const figure = container.querySelector("figure");
    expect(figure?.className).toMatch(/border-l/);
  });

  it("merges a custom className", () => {
    const { container } = render(
      <ShiftQuoteNote quote="x" by="Anna" when="now" className="mt-8" />,
    );
    const figure = container.querySelector("figure");
    expect(figure?.className).toContain("mt-8");
  });
});
