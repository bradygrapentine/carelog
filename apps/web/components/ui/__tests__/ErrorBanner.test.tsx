import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBanner } from "../ErrorBanner";

describe("ErrorBanner", () => {
  it("renders children inside a role=alert element", () => {
    render(<ErrorBanner>Something went wrong</ErrorBanner>);
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Something went wrong");
  });

  it("applies the danger token classes", () => {
    render(<ErrorBanner>oops</ErrorBanner>);
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("bg-[var(--color-danger-subtle)]");
    expect(alert.className).toContain("text-[var(--color-danger)]");
  });

  it("merges incoming className", () => {
    render(<ErrorBanner className="mt-4">oops</ErrorBanner>);
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("mt-4");
    // base classes still present
    expect(alert.className).toContain("rounded-xl");
  });
});
