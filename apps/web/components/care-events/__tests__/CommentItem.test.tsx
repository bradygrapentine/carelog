import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommentItem } from "../CommentItem";

const base = {
  id: "c1",
  authorId: "u1",
  authorName: "Alice",
  body: "hello",
  editedAt: null,
  createdAt: new Date().toISOString(),
};

describe("CommentItem", () => {
  it("renders author, body, no edited badge when not edited", () => {
    render(
      <CommentItem
        comment={base}
        currentUserId="u1"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.queryByText(/edited/i)).toBeNull();
  });

  it("shows edited badge when editedAt present", () => {
    render(
      <CommentItem
        comment={{ ...base, editedAt: new Date().toISOString() }}
        currentUserId="u1"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it("shows Edit/Delete buttons to author only", () => {
    const { rerender } = render(
      <CommentItem
        comment={base}
        currentUserId="u1"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /edit comment/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete comment/i }),
    ).toBeInTheDocument();

    rerender(
      <CommentItem
        comment={base}
        currentUserId="u2"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /edit comment/i })).toBeNull();
  });

  it("calls onEdit with new body after Save", () => {
    const onEdit = vi.fn();
    render(
      <CommentItem
        comment={base}
        currentUserId="u1"
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit comment/i }));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "updated" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onEdit).toHaveBeenCalledWith("c1", "updated");
  });
});
