import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { JournalEntryForm } from "../JournalEntryForm";

function setup(
  overrides: Partial<React.ComponentProps<typeof JournalEntryForm>> = {},
) {
  const onPost = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <JournalEntryForm onPost={onPost} posting={false} {...overrides} />,
  );
  const textarea = screen.getByPlaceholderText("Share how today went...");
  return { onPost, textarea, ...utils };
}

describe("JournalEntryForm", () => {
  it("renders a collapsed textarea with the correct placeholder", () => {
    setup();
    expect(
      screen.getByPlaceholderText("Share how today went..."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("expands when the textarea receives focus", () => {
    const { textarea } = setup();
    fireEvent.focus(textarea);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Share update")).toBeInTheDocument();
  });

  it("expands when text is typed", () => {
    const { textarea } = setup();
    fireEvent.change(textarea, { target: { value: "D" } });
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows prompt suggestions when expanded and text is empty", () => {
    const { textarea } = setup();
    fireEvent.focus(textarea);
    expect(screen.getByText("Need a starting point?")).toBeInTheDocument();
  });

  it("hides prompt suggestions once the user types text", () => {
    const { textarea } = setup();
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "Something" } });
    expect(
      screen.queryByText("Need a starting point?"),
    ).not.toBeInTheDocument();
  });

  it("shows mood buttons after expansion", () => {
    const { textarea } = setup();
    fireEvent.focus(textarea);
    expect(screen.getByText("Good")).toBeInTheDocument();
    expect(screen.getByText("Okay")).toBeInTheDocument();
    expect(screen.getByText("Difficult")).toBeInTheDocument();
    expect(screen.getByText("Crisis")).toBeInTheDocument();
  });

  it("selects a mood when clicked", () => {
    const { textarea } = setup();
    fireEvent.focus(textarea);
    const goodBtn = screen.getByText("Good");
    fireEvent.click(goodBtn);
    expect(goodBtn).toHaveClass("bg-[var(--color-mood-good)]/20");
  });

  it("deselects a mood when clicked twice", () => {
    const { textarea } = setup();
    fireEvent.focus(textarea);
    const goodBtn = screen.getByText("Good");
    fireEvent.click(goodBtn);
    fireEvent.click(goodBtn);
    expect(goodBtn).not.toHaveClass("bg-[var(--color-mood-good)]/20");
  });

  it("switches mood when a different mood is clicked", () => {
    const { textarea } = setup();
    fireEvent.focus(textarea);
    fireEvent.click(screen.getByText("Good"));
    fireEvent.click(screen.getByText("Okay"));
    expect(screen.getByText("Okay")).toHaveClass(
      "bg-[var(--color-mood-okay)]/20",
    );
    expect(screen.getByText("Good")).not.toHaveClass(
      "bg-[var(--color-mood-good)]/20",
    );
  });

  it("resets all state when Cancel is clicked", () => {
    const { textarea } = setup();
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "Some text" } });
    fireEvent.click(screen.getByText("Good"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(textarea).toHaveValue("");
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    expect(screen.queryByText("Good")).not.toBeInTheDocument();
  });

  it("submit button is disabled when textarea is empty", () => {
    const { textarea } = setup();
    fireEvent.focus(textarea);
    const submitBtn = screen.getByText("Share update");
    expect(submitBtn).toBeDisabled();
  });

  it("submit button is disabled when textarea contains only whitespace", () => {
    const { textarea } = setup();
    fireEvent.change(textarea, { target: { value: "   " } });
    expect(screen.getByText("Share update")).toBeDisabled();
  });

  it("calls onPost with trimmed text and selected mood on submit", async () => {
    const { textarea, onPost } = setup();
    fireEvent.focus(textarea);
    fireEvent.change(textarea, {
      target: { value: "  Dad was calm today.  " },
    });
    fireEvent.click(screen.getByText("Good"));
    fireEvent.click(screen.getByText("Share update"));

    await waitFor(() => {
      expect(onPost).toHaveBeenCalledWith("Dad was calm today.", "good");
    });
  });

  it("calls onPost with empty mood when no mood is selected", async () => {
    const { textarea, onPost } = setup();
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "A note." } });
    fireEvent.click(screen.getByText("Share update"));

    await waitFor(() => {
      expect(onPost).toHaveBeenCalledWith("A note.", "");
    });
  });

  it("resets the form after a successful submit", async () => {
    const { textarea } = setup();
    fireEvent.change(textarea, { target: { value: "A note." } });

    await act(async () => {
      fireEvent.click(screen.getByText("Share update"));
    });

    await waitFor(() => {
      expect(textarea).toHaveValue("");
      expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    });
  });

  it('shows "Sharing..." on the submit button while posting', () => {
    render(<JournalEntryForm onPost={vi.fn()} posting={true} />);
    const textarea = screen.getByPlaceholderText("Share how today went...");
    fireEvent.focus(textarea);
    expect(screen.getByText("Sharing...")).toBeInTheDocument();
  });
});
