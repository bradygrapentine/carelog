import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MedAttentionHero } from "../MedAttentionHero";

const oneDose = [{ medName: "Lisinopril", scheduledTime: "8:00a" }];
const threeDoses = [
  { medName: "Lisinopril", scheduledTime: "8:00a" },
  { medName: "Metformin", scheduledTime: "12:00p" },
  { medName: "Atorvastatin", scheduledTime: "9:00p" },
];

describe("<MedAttentionHero />", () => {
  it("returns null when missedDoses is empty", () => {
    const { container } = render(<MedAttentionHero missedDoses={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("when one missed dose, headline uses singular ('1 dose needs catch-up')", () => {
    render(<MedAttentionHero missedDoses={oneDose} />);
    expect(
      screen.getByText(/1 dose needs catch-up/i),
    ).toBeInTheDocument();
  });

  it("when multiple, headline uses plural ('3 doses need catch-up')", () => {
    render(<MedAttentionHero missedDoses={threeDoses} />);
    expect(
      screen.getByText(/3 doses need catch-up/i),
    ).toBeInTheDocument();
  });

  it("renders one row per missed dose with med name + time", () => {
    render(<MedAttentionHero missedDoses={threeDoses} />);
    expect(screen.getByText("Lisinopril")).toBeInTheDocument();
    expect(screen.getByText("8:00a")).toBeInTheDocument();
    expect(screen.getByText("Metformin")).toBeInTheDocument();
    expect(screen.getByText("12:00p")).toBeInTheDocument();
    expect(screen.getByText("Atorvastatin")).toBeInTheDocument();
    expect(screen.getByText("9:00p")).toBeInTheDocument();
  });

  it("clicking a 'Record catch-up' button calls onRecordCatchUp with the right medName", () => {
    const onRecordCatchUp = vi.fn();
    render(
      <MedAttentionHero
        missedDoses={oneDose}
        onRecordCatchUp={onRecordCatchUp}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /record catch-up dose for lisinopril/i }),
    );
    expect(onRecordCatchUp).toHaveBeenCalledWith("Lisinopril");
  });

  it("each catch-up button has an accessible name including the med name", () => {
    render(<MedAttentionHero missedDoses={threeDoses} />);
    const buttons = screen.getAllByRole("button");
    const names = buttons.map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");
    expect(names.some((n) => /lisinopril/i.test(n))).toBe(true);
    expect(names.some((n) => /metformin/i.test(n))).toBe(true);
    expect(names.some((n) => /atorvastatin/i.test(n))).toBe(true);
  });

  it("renders an RxGlyph next to each missed dose med name", () => {
    render(<MedAttentionHero missedDoses={threeDoses} />);
    const glyphs = screen.getAllByRole("img");
    expect(glyphs).toHaveLength(threeDoses.length);
  });
});
