import { render, screen } from "@testing-library/react";
import { HeroSection } from "../HeroSection";

describe("HeroSection", () => {
  it("renders the main headline", () => {
    render(<HeroSection />);
    expect(
      screen.getByRole("heading", { level: 1 })
    ).toHaveTextContent("Care made simple for families who show up every day");
  });

  it("renders primary CTA with correct href", () => {
    render(<HeroSection />);
    const cta = screen.getByRole("link", { name: /start free trial/i });
    expect(cta).toHaveAttribute("href", "/signin");
  });

  it("marks floating cards as decorative", () => {
    render(<HeroSection />);
    const cards = screen.getAllByRole("presentation");
    expect(cards.length).toBeGreaterThan(0);
  });
});
