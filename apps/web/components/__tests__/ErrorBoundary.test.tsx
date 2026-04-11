import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ErrorBoundary } from "../ErrorBoundary";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

beforeAll(() => {
  console.error = vi.fn();
});

function ThrowingChild() {
  throw new Error("test error");
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <p>Child content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders fallback UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We ran into an unexpected problem. Try refreshing the page.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /refresh/i }),
    ).toBeInTheDocument();
  });

  it("does not render the throwing child's content", () => {
    render(
      <ErrorBoundary>
        <p>Should not appear</p>
        <ThrowingChild />
      </ErrorBoundary>,
    );
    expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
  });
});
