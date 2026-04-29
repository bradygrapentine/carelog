import { render, screen } from "@testing-library/react";
import { HeroSection } from "../HeroSection";

describe("HeroSection", () => {
  it("renders the editorial headline with italic emphasis spans", () => {
    render(<HeroSection />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/three states away/i);
    expect(heading.querySelectorAll("em").length).toBeGreaterThan(0);
  });

  it("renders eyebrow with the CareSync brand and founding voice", () => {
    render(<HeroSection />);
    expect(
      screen.getByText(/CareSync . Built by a caregiver, for caregivers/i),
    ).toBeInTheDocument();
  });

  it("renders primary CTA with correct href", () => {
    render(<HeroSection />);
    const cta = screen.getByRole("link", { name: /start your family.s log/i });
    expect(cta).toHaveAttribute("href", "/signin");
  });

  it("renders secondary CTA pointing to how-it-works section", () => {
    render(<HeroSection />);
    const cta = screen.getByRole("link", { name: /see how it works/i });
    expect(cta).toHaveAttribute("href", "/#how-it-works");
  });
});
