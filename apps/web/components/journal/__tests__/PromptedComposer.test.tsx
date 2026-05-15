import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PromptedComposer } from "../PromptedComposer";

const captureMock = vi.fn();
vi.mock("posthog-js", () => ({
  default: { capture: (...args: unknown[]) => captureMock(...args) },
}));

beforeEach(() => {
  captureMock.mockClear();
});

describe("PromptedComposer — rendering", () => {
  it("renders three labelled question inputs", () => {
    render(<PromptedComposer onPost={vi.fn()} posting={false} />);
    expect(screen.getByLabelText(/Today they/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/What I noticed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Worth flagging/i)).toBeInTheDocument();
  });

  it("renders the four mood radios", () => {
    render(<PromptedComposer onPost={vi.fn()} posting={false} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
  });

  it("Save button is disabled when all fields are empty", () => {
    render(<PromptedComposer onPost={vi.fn()} posting={false} />);
    const btn = screen.getByRole("button", { name: /Save entry/i });
    expect(btn).toBeDisabled();
  });
});

describe("PromptedComposer — submit", () => {
  it("combines the three answers into a single body and calls onPost", async () => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    render(<PromptedComposer onPost={onPost} posting={false} />);
    fireEvent.change(screen.getByLabelText(/Today they/i), {
      target: { value: "slept well" },
    });
    fireEvent.change(screen.getByLabelText(/What I noticed/i), {
      target: { value: "ate breakfast" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save entry/i }));
    await waitFor(() => expect(onPost).toHaveBeenCalledTimes(1));
    const [body, mood] = onPost.mock.calls[0];
    expect(body).toContain("Today they — slept well");
    expect(body).toContain("What I noticed: ate breakfast");
    expect(mood).toBe("");
  });

  it("does not submit when all three inputs are blank", () => {
    const onPost = vi.fn();
    render(<PromptedComposer onPost={onPost} posting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Save entry/i }));
    expect(onPost).not.toHaveBeenCalled();
  });

  it("captures a posthog event without PII (only mood + char_count + composer)", async () => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    render(<PromptedComposer onPost={onPost} posting={false} />);
    fireEvent.change(screen.getByLabelText(/Today they/i), {
      target: { value: "ok" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save entry/i }));
    await waitFor(() => expect(captureMock).toHaveBeenCalledTimes(1));
    const [event, payload] = captureMock.mock.calls[0];
    expect(event).toBe("journal_entry_submitted");
    expect(Object.keys(payload as object).sort()).toEqual([
      "char_count",
      "composer",
      "mood",
    ]);
  });

  it("clears all fields after a successful submit", async () => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    render(<PromptedComposer onPost={onPost} posting={false} />);
    const todayInput = screen.getByLabelText(/Today they/i) as HTMLInputElement;
    fireEvent.change(todayInput, { target: { value: "good day" } });
    fireEvent.click(screen.getByRole("button", { name: /Save entry/i }));
    await waitFor(() => expect(onPost).toHaveBeenCalled());
    await waitFor(() => expect(todayInput.value).toBe(""));
  });
});

describe("PromptedComposer — mood picker", () => {
  it("toggling a mood radio sets aria-checked", () => {
    render(<PromptedComposer onPost={vi.fn()} posting={false} />);
    const okay = screen.getByRole("radio", { name: /Okay/i });
    fireEvent.click(okay);
    expect(okay).toHaveAttribute("aria-checked", "true");
    // clicking again clears it
    fireEvent.click(okay);
    expect(okay).toHaveAttribute("aria-checked", "false");
  });

  it("only one mood is checked at a time", () => {
    render(<PromptedComposer onPost={vi.fn()} posting={false} />);
    fireEvent.click(screen.getByRole("radio", { name: /Good/i }));
    fireEvent.click(screen.getByRole("radio", { name: /Hard/i }));
    expect(screen.getByRole("radio", { name: /Good/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("radio", { name: /Hard/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

describe("PromptedComposer — accessibility", () => {
  it("each input has a programmatically associated label", () => {
    render(<PromptedComposer onPost={vi.fn()} posting={false} />);
    expect(screen.getByLabelText(/Today they/i).tagName).toBe("INPUT");
    expect(screen.getByLabelText(/What I noticed/i).tagName).toBe("INPUT");
    expect(screen.getByLabelText(/Worth flagging/i).tagName).toBe("INPUT");
  });

  it("mood radios live inside a labelled radiogroup", () => {
    render(<PromptedComposer onPost={vi.fn()} posting={false} />);
    expect(
      screen.getByRole("radiogroup", { name: /Mood/i }),
    ).toBeInTheDocument();
  });
});
