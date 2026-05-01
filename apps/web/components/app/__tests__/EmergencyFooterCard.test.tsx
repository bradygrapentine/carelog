import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmergencyFooterCard } from "../EmergencyFooterCard";

describe("EmergencyFooterCard", () => {
  it("renders the Emergency eyebrow", () => {
    render(<EmergencyFooterCard dnrStatus="Full code" />);
    expect(screen.getByText(/^Emergency$/i)).toBeInTheDocument();
  });

  it("renders the DNR / code status when provided", () => {
    render(<EmergencyFooterCard dnrStatus="DNR — full code declined" />);
    expect(screen.getByText(/dnr — full code declined/i)).toBeInTheDocument();
  });

  it("renders the primary contact name", () => {
    render(
      <EmergencyFooterCard
        primaryContact={{ name: "Sarah H.", relationship: "Daughter" }}
      />,
    );
    expect(screen.getByText("Sarah H.")).toBeInTheDocument();
    expect(screen.getByText(/daughter/i)).toBeInTheDocument();
  });

  it("renders contact phone as a tel: link with descriptive aria-label", () => {
    render(
      <EmergencyFooterCard
        primaryContact={{
          name: "Sarah H.",
          phone: "+15555550123",
        }}
      />,
    );
    const link = screen.getByRole("link", { name: /call sarah h\./i });
    expect(link).toHaveAttribute("href", "tel:+15555550123");
  });

  it("does not render a tel: link when phone is omitted", () => {
    render(<EmergencyFooterCard primaryContact={{ name: "Sarah H." }} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the hospital preference when provided", () => {
    render(<EmergencyFooterCard hospital="Memorial Cooper" />);
    expect(screen.getByText(/memorial cooper/i)).toBeInTheDocument();
  });

  it("renders empty fallback when no fields are provided", () => {
    render(<EmergencyFooterCard />);
    expect(
      screen.getByText(/no emergency information recorded/i),
    ).toBeInTheDocument();
  });

  it("section has aria-label='Emergency information'", () => {
    render(<EmergencyFooterCard hospital="x" />);
    expect(
      screen.getByRole("region", { name: /emergency information/i }),
    ).toBeInTheDocument();
  });
});
