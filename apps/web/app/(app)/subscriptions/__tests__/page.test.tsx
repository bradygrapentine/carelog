import { render, screen } from "@testing-library/react";
import SubscriptionsPage from "../page";

describe("SubscriptionsPage", () => {
  it("renders page heading", () => {
    render(<SubscriptionsPage />);
    expect(screen.getByRole("heading", { name: /subscription/i })).toBeInTheDocument();
  });

  it("shows Family Plan name", () => {
    render(<SubscriptionsPage />);
    expect(screen.getByText(/family plan/i)).toBeInTheDocument();
  });

  it("shows $14/mo price", () => {
    render(<SubscriptionsPage />);
    expect(screen.getByText(/\$14/)).toBeInTheDocument();
  });

  it("shows cancel subscription option", () => {
    render(<SubscriptionsPage />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
});
