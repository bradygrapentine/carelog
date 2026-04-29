import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormActionRow } from "../FormActionRow";

describe("FormActionRow", () => {
  it("renders submit with default label 'Save'", () => {
    render(<FormActionRow />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders submit with custom label", () => {
    render(<FormActionRow submitLabel="Add medication" />);
    expect(
      screen.getByRole("button", { name: "Add medication" }),
    ).toBeInTheDocument();
  });

  it("hides Cancel when onCancel is not provided", () => {
    render(<FormActionRow submitLabel="Save" />);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("renders Cancel and calls handler when onCancel is provided", () => {
    const onCancel = vi.fn();
    render(<FormActionRow submitLabel="Save" onCancel={onCancel} />);
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses a custom cancel label when provided", () => {
    const onCancel = vi.fn();
    render(
      <FormActionRow
        submitLabel="Send"
        cancelLabel="Discard"
        onCancel={onCancel}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Discard" }),
    ).toBeInTheDocument();
  });

  it("disables submit when loading={true}", () => {
    render(<FormActionRow submitLabel="Saving..." loading />);
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
  });

  it("disables submit when disabled={true}", () => {
    render(<FormActionRow submitLabel="Save" disabled />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("merges className onto the wrapper", () => {
    const { container } = render(
      <FormActionRow submitLabel="Save" className="mt-4" />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("mt-4");
    expect(wrapper.className).toContain("flex");
  });
});
