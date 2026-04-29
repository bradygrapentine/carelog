import { render, screen, fireEvent } from "@testing-library/react";
import { PricingCards } from "../PricingCards";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("PricingCards", () => {
  beforeEach(() => {
    mockPush.mockClear();
    sessionStorage.clear();
  });

  it("renders both plan tiers", () => {
    render(<PricingCards />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Family Plan")).toBeInTheDocument();
  });

  it("shows the $14/mo price by default (monthly)", () => {
    render(<PricingCards />);
    expect(screen.getByText("$14")).toBeInTheDocument();
    expect(screen.getAllByText(/\/mo/).length).toBeGreaterThan(0);
  });

  it("switches to annual price when Annual toggle clicked", () => {
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /annual/i }));
    expect(screen.getByText("$120")).toBeInTheDocument();
    expect(screen.getByText("/yr")).toBeInTheDocument();
    expect(screen.getByText("$10/mo, save $48/yr")).toBeInTheDocument();
  });

  it("marks family plan as most popular", () => {
    render(<PricingCards />);
    expect(screen.getByText(/most popular/i)).toBeInTheDocument();
  });

  it("Start the family plan button stores pendingPlan in sessionStorage and navigates to /signin", () => {
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /start the family plan/i }));
    const stored = JSON.parse(sessionStorage.getItem("pendingPlan") ?? "{}");
    expect(stored).toEqual({ plan: "family", interval: "month" });
    expect(mockPush).toHaveBeenCalledWith("/signin");
  });

  it("Start the family plan with annual interval stores correct interval", () => {
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /annual/i }));
    fireEvent.click(screen.getByRole("button", { name: /start the family plan/i }));
    const stored = JSON.parse(sessionStorage.getItem("pendingPlan") ?? "{}");
    expect(stored).toEqual({ plan: "family", interval: "year" });
  });

  it("Free tier Get started links to /signin", () => {
    render(<PricingCards />);
    const link = screen.getByRole("link", { name: /get started/i });
    expect(link).toHaveAttribute("href", "/signin");
  });
});
