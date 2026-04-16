import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookOpen } from "lucide-react";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders title, description, and action button", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        icon={BookOpen}
        title="No entries yet"
        description="Start journaling to track care activities."
        actionLabel="Add entry"
        onAction={onAction}
      />,
    );
    expect(screen.getByText("No entries yet")).toBeInTheDocument();
    expect(screen.getByText(/Start journaling/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add entry" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add entry" }));
    expect(onAction).toHaveBeenCalled();
  });

  it("renders without action button when not provided", () => {
    render(
      <EmptyState icon={BookOpen} title="Nothing here" description="Check back later." />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders without action button when only actionLabel is provided (no onAction)", () => {
    render(
      <EmptyState icon={BookOpen} title="Nothing" description="Empty." actionLabel="Add" />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
