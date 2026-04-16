import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MedicationChipBar } from "../MedicationChipBar";

const medications = [
  { id: "med-1", drug_name: "Lisinopril", brand_name: "Zestril" },
  { id: "med-2", drug_name: "Metformin", brand_name: null },
];

describe("<MedicationChipBar />", () => {
  it("renders All chip and medication chips", () => {
    render(
      <MedicationChipBar
        medications={medications}
        selected={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Lisinopril" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Metformin" }),
    ).toBeInTheDocument();
  });

  it("All chip has aria-pressed=true when selected is null", () => {
    render(
      <MedicationChipBar
        medications={medications}
        selected={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("medication chip has aria-pressed=true when it matches selected", () => {
    render(
      <MedicationChipBar
        medications={medications}
        selected="med-1"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Lisinopril" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Metformin" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicking a medication chip calls onSelect with its id", () => {
    const onSelect = vi.fn();
    render(
      <MedicationChipBar
        medications={medications}
        selected={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Metformin" }));
    expect(onSelect).toHaveBeenCalledWith("med-2");
  });

  it("clicking All chip calls onSelect with null", () => {
    const onSelect = vi.fn();
    render(
      <MedicationChipBar
        medications={medications}
        selected="med-1"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("returns null when medications array is empty", () => {
    const { container } = render(
      <MedicationChipBar medications={[]} selected={null} onSelect={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
