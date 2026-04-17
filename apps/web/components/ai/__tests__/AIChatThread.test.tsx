import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AIChatThread } from "../AIChatThread";

vi.mock("../AIActionCard", () => ({
  AIActionCard: () => <div data-testid="action-card" />,
}));

const noop = () => {};

describe("AIChatThread", () => {
  it("shows empty state when messages is empty", () => {
    render(
      <AIChatThread
        messages={[]}
        onConfirmAction={noop}
        onCancelAction={noop}
      />,
    );
    expect(
      screen.getByText(/ask me anything/i),
    ).toBeInTheDocument();
  });

  it("renders messages when provided", () => {
    render(
      <AIChatThread
        messages={[{ role: "user", content: "Hello there" }]}
        onConfirmAction={noop}
        onCancelAction={noop}
      />,
    );
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.queryByText(/ask me anything/i)).not.toBeInTheDocument();
  });
});
