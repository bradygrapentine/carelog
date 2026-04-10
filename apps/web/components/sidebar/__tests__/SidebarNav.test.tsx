import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarContext } from "../SidebarContext";
import { SidebarNav } from "../SidebarNav";
import type { Destination } from "../SidebarContext";

function renderNav(active: Destination = "journal", onNavigate = vi.fn()) {
  return render(
    <SidebarContext.Provider
      value={{ activeDestination: active, setActiveDestination: onNavigate }}
    >
      <SidebarNav />
    </SidebarContext.Provider>,
  );
}

describe("SidebarNav", () => {
  it("renders all 6 nav items", () => {
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
    const onNavigate = vi.fn();
    renderNav("journal", onNavigate);
    fireEvent.click(screen.getByRole("button", { name: /team/i }));
    expect(onNavigate).toHaveBeenCalledWith("team");
  });
});
