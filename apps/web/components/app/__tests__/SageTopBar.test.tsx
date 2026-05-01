import { render, screen } from "@testing-library/react";
import { SageTopBar } from "../SageTopBar";

describe("SageTopBar", () => {
  it("renders the title text", () => {
    render(<SageTopBar title="Journal" />);
    expect(screen.getByText("Journal")).toBeInTheDocument();
  });

  it("renders the crumb when provided and a separator", () => {
    render(<SageTopBar title="Journal" crumb="Margaret H." />);
    expect(screen.getByText("Margaret H.")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("does NOT render the crumb section when crumb is undefined", () => {
    render(<SageTopBar title="Journal" />);
    expect(screen.queryByTestId("topbar-crumb")).not.toBeInTheDocument();
  });

  it("renders a search input with the default placeholder", () => {
    render(<SageTopBar title="Journal" />);
    expect(
      screen.getByPlaceholderText("Search Margaret's record"),
    ).toBeInTheDocument();
  });

  it("renders the ⌘K kbd hint", () => {
    render(<SageTopBar title="Journal" />);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("does NOT render the search when showSearch is false", () => {
    render(<SageTopBar title="Journal" showSearch={false} />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByText("⌘K")).not.toBeInTheDocument();
  });

  it("renders the action slot when provided", () => {
    render(
      <SageTopBar title="Journal" action={<button>Add entry</button>} />,
    );
    expect(
      screen.getByRole("button", { name: "Add entry" }),
    ).toBeInTheDocument();
  });

  it("search input has type='search' and an accessible label", () => {
    render(<SageTopBar title="Journal" />);
    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("type", "search");
    // Either visible label or aria-label must be present
    const hasAriaLabel = input.hasAttribute("aria-label");
    const id = input.getAttribute("id");
    const hasVisibleLabel = id
      ? document.querySelector(`label[for="${id}"]`) !== null
      : false;
    expect(hasAriaLabel || hasVisibleLabel).toBe(true);
  });
});
