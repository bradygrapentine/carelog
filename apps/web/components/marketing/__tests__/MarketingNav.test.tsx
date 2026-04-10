import { render, screen } from "@testing-library/react";
import { MarketingNav } from "../MarketingNav";

describe("MarketingNav", () => {
  it("renders Carelog logo text", () => {
    render(<MarketingNav />);
    expect(screen.getByText("Carelog")).toBeInTheDocument();
  });

  it("renders all nav links", () => {
    render(<MarketingNav />);
    expect(screen.getByRole("link", { name: /features/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pricing/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /about/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contact/i })).toBeInTheDocument();
  });

  it("renders sign in CTA", () => {
    render(<MarketingNav />);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });
});
