import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RxGlyph } from "../RxGlyph";

describe("<RxGlyph />", () => {
  it("renders the ℞ character (U+211E)", () => {
    render(<RxGlyph />);
    expect(screen.getByRole("img")).toHaveTextContent("℞");
  });

  it("has role='img' and default aria-label='Medication'", () => {
    render(<RxGlyph />);
    const el = screen.getByRole("img");
    expect(el).toHaveAttribute("aria-label", "Medication");
  });

  it("accepts a custom ariaLabel prop", () => {
    render(<RxGlyph ariaLabel="Prescription symbol" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Prescription symbol",
    );
  });

  it("applies the size prop as font-size", () => {
    render(<RxGlyph size={24} />);
    const el = screen.getByRole("img");
    expect(el).toHaveStyle({ fontSize: "24px" });
  });
});
