import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { AppTabBar } from "../AppTabBar";

const mockPush = vi.fn();
let mockPathname = "/journal/recipient-123";
let mockSearch = "panel=journal";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ push: mockPush }),
}));

describe("AppTabBar — inside team context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/journal/recipient-123";
    mockSearch = "panel=journal";
  });

  it("renders all tab labels", () => {
    render(<AppTabBar userInitials="BG" />);
    expect(
      screen.getAllByRole("tab", { name: /journal/i })[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("tab", { name: /medications/i })[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("tab", { name: /team/i })[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("tab", { name: /shifts/i })[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("tab", { name: /documents/i })[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("tab", { name: /more/i })[0],
    ).toBeInTheDocument();
  });

  it("marks the active tab with aria-selected based on URL", () => {
    render(<AppTabBar userInitials="BG" />);
    const journalTabs = screen.getAllByRole("tab", { name: /journal/i });
    expect(journalTabs[0]).toHaveAttribute("aria-selected", "true");
    const medTabs = screen.getAllByRole("tab", { name: /medications/i });
    expect(medTabs[0]).toHaveAttribute("aria-selected", "false");
  });

  it("calls router.push with correct URL when a tab is clicked", () => {
    render(<AppTabBar userInitials="BG" />);
    fireEvent.click(screen.getAllByRole("tab", { name: /team/i })[0]);
    expect(mockPush).toHaveBeenCalledWith("/journal/recipient-123?panel=team");
  });

  it("renders user initials in avatar", () => {
    render(<AppTabBar userInitials="BG" />);
    expect(screen.getByText("BG")).toBeInTheDocument();
  });
});

describe("AppTabBar — outside team context (dashboard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/dashboard";
    mockSearch = "";
  });

  it("does not render tab buttons on the dashboard", () => {
    render(<AppTabBar userInitials="BG" />);
    expect(screen.queryByRole("tab", { name: /medications/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /journal/i })).toBeNull();
  });

  it("still renders the user avatar", () => {
    render(<AppTabBar userInitials="BG" />);
    expect(screen.getByText("BG")).toBeInTheDocument();
  });
});
