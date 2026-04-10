import { render, screen, fireEvent } from "@testing-library/react";
import { AppTabBar } from "../AppTabBar";

describe("AppTabBar", () => {
  it("renders all tab labels", () => {
    render(<AppTabBar activeTab="journal" onTabChange={vi.fn()} userInitials="BG" />);
    expect(screen.getByRole("tab", { name: /journal/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /medications/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /team/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /shifts/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /documents/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /more/i })).toBeInTheDocument();
  });

  it("marks the active tab with aria-selected", () => {
    render(<AppTabBar activeTab="medications" onTabChange={vi.fn()} userInitials="BG" />);
    expect(screen.getByRole("tab", { name: /medications/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /journal/i })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    render(<AppTabBar activeTab="journal" onTabChange={onTabChange} userInitials="BG" />);
    fireEvent.click(screen.getByRole("tab", { name: /team/i }));
    expect(onTabChange).toHaveBeenCalledWith("team");
  });

  it("renders user initials in avatar", () => {
    render(<AppTabBar activeTab="journal" onTabChange={vi.fn()} userInitials="BG" />);
    expect(screen.getByText("BG")).toBeInTheDocument();
  });
});
