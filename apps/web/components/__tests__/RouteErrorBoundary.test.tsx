import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

beforeAll(() => {
  console.error = vi.fn();
});

describe("<RouteErrorBoundary />", () => {
  const mockError = Object.assign(new Error("Boom"), { digest: "abc" });
  const mockReset = vi.fn();

  it('renders headline "Something went wrong here"', () => {
    render(
      <RouteErrorBoundary
        error={mockError}
        reset={mockReset}
        routeName="settings"
      />,
    );
    expect(screen.getByText("Something went wrong here")).toBeInTheDocument();
  });

  it("renders the error message", () => {
    render(
      <RouteErrorBoundary
        error={mockError}
        reset={mockReset}
        routeName="settings"
      />,
    );
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it('calls reset when "Try again" is clicked', () => {
    mockReset.mockClear();
    render(
      <RouteErrorBoundary
        error={mockError}
        reset={mockReset}
        routeName="settings"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('"Go to dashboard" links to /dashboard', () => {
    render(
      <RouteErrorBoundary
        error={mockError}
        reset={mockReset}
        routeName="settings"
      />,
    );
    const link = screen.getByRole("link", { name: /go to dashboard/i });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("does not render error message when error.message is empty", () => {
    const emptyError = Object.assign(new Error(""), { digest: "xyz" });
    emptyError.message = "";
    render(
      <RouteErrorBoundary
        error={emptyError}
        reset={mockReset}
        routeName="billing"
      />,
    );
    // Descriptive copy still present
    expect(screen.getByText(/this page hit an error/i)).toBeInTheDocument();
    // No mono error block
    expect(
      screen.queryByRole("paragraph", { name: /boom/i }),
    ).not.toBeInTheDocument();
  });

  it("logs the error to console with routeName prefix", () => {
    const consoleSpy = vi.spyOn(console, "error");
    const err = new Error("Logging test");
    render(
      <RouteErrorBoundary error={err} reset={mockReset} routeName="messages" />,
    );
    expect(consoleSpy).toHaveBeenCalledWith("[messages] route error:", err);
  });
});
