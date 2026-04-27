import { render, screen } from "@testing-library/react";
import { RoleBadge } from "../RoleBadge";

describe("RoleBadge", () => {
  it("renders coordinator with primary token style", () => {
    render(<RoleBadge role="coordinator" />);
    const badge = screen.getByText("Coordinator");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/--color-primary/);
  });

  it("renders caregiver with amber style", () => {
    render(<RoleBadge role="caregiver" />);
    expect(screen.getByText("Caregiver")).toBeInTheDocument();
  });

  it("renders supporter with gray style", () => {
    render(<RoleBadge role="supporter" />);
    expect(screen.getByText("Supporter")).toBeInTheDocument();
  });

  it("renders aide with slate style", () => {
    render(<RoleBadge role="aide" />);
    expect(screen.getByText("Aide")).toBeInTheDocument();
  });
});
