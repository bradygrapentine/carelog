import { render, screen } from "@testing-library/react";
import { PricingCards } from "../PricingCards";

describe("PricingCards", () => {
  it("renders both plan tiers", () => {
    render(<PricingCards />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Family Plan")).toBeInTheDocument();
  });

  it("shows the $14/mo price", () => {
    render(<PricingCards />);
    expect(screen.getByText("$14")).toBeInTheDocument();
  });

  it("marks family plan as most popular", () => {
    render(<PricingCards />);
    expect(screen.getByText(/most popular/i)).toBeInTheDocument();
  });

  it("links Start free trial to signin", () => {
    render(<PricingCards />);
    const cta = screen.getAllByRole("link", { name: /start free trial/i })[0];
    expect(cta).toHaveAttribute("href", "/signin");
  });
});
