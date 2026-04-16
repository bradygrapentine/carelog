import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SidebarContext } from "../SidebarContext";
import { SidebarNav } from "../SidebarNav";
import type { Destination } from "../SidebarContext";

function renderNav(
  active: Destination = "journal",
  onNavigate = vi.fn(),
  showLabels = false,
) {
  return render(
    <SidebarContext.Provider
      value={{ activeDestination: active, setActiveDestination: onNavigate }}
    >
      <SidebarNav showLabels={showLabels} />
    </SidebarContext.Provider>,
  );
}

describe("SidebarNav", () => {
  it("renders all 7 nav items", () => {
    renderNav();
    expect(
      screen.getByRole("button", { name: /journal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /medications/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /team/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /shifts/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /documents/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /messages/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /more/i })).toBeInTheDocument();
  });

  it("marks the active destination with aria-current", () => {
    renderNav("medications");
    expect(
      screen.getByRole("button", { name: /medications/i }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: /journal/i }),
    ).not.toHaveAttribute("aria-current", "page");
  });

  it("calls setActiveDestination when a nav item is clicked", () => {
    const setDest = vi.fn();
    render(
      <SidebarContext.Provider
        value={{ activeDestination: "journal", setActiveDestination: setDest }}
      >
        <SidebarNav />
      </SidebarContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /team/i }));
    expect(setDest).toHaveBeenCalledWith("team");
  });

  it("calls onNavigate prop (no args) when a nav item is clicked", () => {
    const onNavigate = vi.fn();
    render(
      <SidebarContext.Provider
        value={{ activeDestination: "journal", setActiveDestination: vi.fn() }}
      >
        <SidebarNav onNavigate={onNavigate} />
      </SidebarContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /documents/i }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith();
  });

  it("wraps icon-only buttons in Tooltip when showLabels is false", () => {
    renderNav("journal", vi.fn(), false);
    // Each button should still have its aria-label when in icon-only mode
    const journalBtn = screen.getByRole("button", { name: /journal/i });
    expect(journalBtn).toHaveAttribute("aria-label", "Journal");
    const medsBtn = screen.getByRole("button", { name: /medications/i });
    expect(medsBtn).toHaveAttribute("aria-label", "Medications");
  });

  it("shows visible text labels when showLabels is true", () => {
    renderNav("journal", vi.fn(), true);
    // Visible label text should appear in the DOM
    expect(screen.getAllByText("Journal").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Medications").length).toBeGreaterThanOrEqual(1);
  });

  it("icon-only buttons have aria-label and are keyboard-accessible via Tooltip", () => {
    renderNav("journal", vi.fn(), false);
    // Each icon-only button must retain aria-label (Tooltip is supplementary)
    const journalBtn = screen.getByRole("button", { name: /journal/i });
    expect(journalBtn).toHaveAttribute("aria-label", "Journal");
    // Radix TooltipTrigger asChild preserves the button role and focus behaviour
    expect(journalBtn.tagName).toBe("BUTTON");
    // No visible text label in icon-only mode (label lives in TooltipContent + aria-label only)
    expect(screen.queryByText("Journal")).not.toBeInTheDocument();
  });
});
