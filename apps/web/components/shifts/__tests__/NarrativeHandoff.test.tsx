import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NarrativeHandoff } from "../NarrativeHandoff";

const viewEntries = [
  { heading: "Sleep was rough", body: "Up twice overnight." },
  { heading: "Meds given", body: "Donepezil taken at 9pm." },
  { body: "PT appointment confirmed for 10a." },
];

describe("<NarrativeHandoff /> view mode", () => {
  it("renders the headline 'Three things you need to know'", () => {
    render(
      <NarrativeHandoff
        entries={viewEntries}
        author={{ name: "Sarah", shiftLabel: "Night" }}
        when="2 hours ago"
      />,
    );
    expect(
      screen.getByText(/Three things you need to know/i),
    ).toBeInTheDocument();
  });

  it("renders one paragraph per entry", () => {
    render(
      <NarrativeHandoff
        entries={viewEntries}
        author={{ name: "Sarah" }}
        when="just now"
      />,
    );
    expect(screen.getByText("Up twice overnight.")).toBeInTheDocument();
    expect(screen.getByText("Donepezil taken at 9pm.")).toBeInTheDocument();
    expect(
      screen.getByText("PT appointment confirmed for 10a."),
    ).toBeInTheDocument();
  });

  it("renders the author name in the eyebrow", () => {
    render(
      <NarrativeHandoff
        entries={viewEntries}
        author={{ name: "Sarah", shiftLabel: "Night" }}
        when="3h ago"
      />,
    );
    expect(screen.getByText(/HANDOFF/i)).toBeInTheDocument();
    expect(screen.getByText(/Sarah/)).toBeInTheDocument();
  });

  it("shows empty fallback when entries is empty", () => {
    render(
      <NarrativeHandoff
        entries={[]}
        author={{ name: "Sarah" }}
        when="just now"
      />,
    );
    expect(
      screen.getByText(/Nothing flagged this shift/i),
    ).toBeInTheDocument();
  });
});

describe("<NarrativeHandoff /> edit mode", () => {
  it("renders 3 textareas by default", () => {
    render(
      <NarrativeHandoff
        mode="edit"
        onSubmit={vi.fn()}
      />,
    );
    const textareas = screen.getAllByRole("textbox");
    // 3 body textareas + 3 optional heading inputs = up to 6 textboxes;
    // we need at least 3 body textareas
    expect(textareas.length).toBeGreaterThanOrEqual(3);
  });

  it("renders defaultEntries-many body textareas when provided", () => {
    render(
      <NarrativeHandoff
        mode="edit"
        defaultEntries={[
          { body: "Entry 1" },
          { body: "Entry 2" },
        ]}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("Entry 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Entry 2")).toBeInTheDocument();
  });

  it("'Post handoff' button calls onSubmit with the entry array", () => {
    const onSubmit = vi.fn();
    render(
      <NarrativeHandoff
        mode="edit"
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Post handoff/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith(expect.any(Array));
  });

  it("disables the post button when submitting", () => {
    render(
      <NarrativeHandoff
        mode="edit"
        onSubmit={vi.fn()}
        submitting
      />,
    );
    expect(
      screen.getByRole("button", { name: /Post handoff/i }),
    ).toBeDisabled();
  });
});
