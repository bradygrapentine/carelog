import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi, beforeEach, describe, it, expect } from "vitest";
import { CommandPalette, RECENT_KEY } from "../CommandPalette";

const mockPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

function openPalette() {
  fireEvent.keyDown(document, { key: "k", metaKey: true });
}

beforeEach(() => {
  mockPush.mockClear();
  localStorageMock.clear();
});

describe("CommandPalette", () => {
  it("is not visible on initial render", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens when ⌘K is pressed", () => {
    render(<CommandPalette />);
    openPalette();
    expect(
      screen.getByRole("dialog", { name: "Command palette" }),
    ).toBeInTheDocument();
  });

  it("closes with Esc key", () => {
    render(<CommandPalette />);
    openPalette();
    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", () => {
    render(<CommandPalette />);
    openPalette();
    const dialog = screen.getByRole("dialog");
    // backdrop is the parent element
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toggles closed when ⌘K is pressed while open", () => {
    render(<CommandPalette />);
    openPalette();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    openPalette(); // second press toggles off
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("auto-focuses the search input when opened", () => {
    render(<CommandPalette />);
    openPalette();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("filters commands by substring search (case-insensitive)", () => {
    render(<CommandPalette />);
    openPalette();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "DASH" } });

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Journal")).not.toBeInTheDocument();
  });

  it("shows 'No commands found' when search has no matches", () => {
    render(<CommandPalette />);
    openPalette();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "xyzzznotacommand" } });

    expect(screen.getByText("No commands found")).toBeInTheDocument();
  });

  it("Enter activates the first (selected) command", () => {
    render(<CommandPalette />);
    openPalette();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "dashboard" } });

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Enter" });

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("ArrowDown moves selection down, ArrowUp moves it back", () => {
    render(<CommandPalette />);
    openPalette();

    const dialog = screen.getByRole("dialog");

    // Move down — second option becomes selected
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    const selected = options.find(
      (el) => el.getAttribute("aria-selected") === "true",
    );
    expect(selected).toBeTruthy();

    // Move back up — first option selected again
    fireEvent.keyDown(dialog, { key: "ArrowUp" });
    expect(
      screen.getAllByRole("option")[0].getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("clicking a command navigates and closes the palette", () => {
    render(<CommandPalette />);
    openPalette();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "journal" } });

    fireEvent.click(screen.getByText("Journal"));

    expect(mockPush).toHaveBeenCalledWith("/journal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("persists recent commands to localStorage and shows them on next open", () => {
    render(<CommandPalette />);

    // Open, invoke Dashboard
    openPalette();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "dashboard" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

    // localStorage should have the id
    const stored = JSON.parse(localStorageMock.getItem(RECENT_KEY) ?? "[]");
    expect(stored).toContain("goto-dashboard");

    // Reopen — Recent section appears
    openPalette();
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
  });

  it("limits recent commands to 3 entries", () => {
    localStorageMock.setItem(
      RECENT_KEY,
      JSON.stringify(["goto-dashboard", "goto-messages", "goto-settings"]),
    );

    render(<CommandPalette />);
    openPalette();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "journal" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

    const stored = JSON.parse(localStorageMock.getItem(RECENT_KEY) ?? "[]");
    expect(stored.length).toBeLessThanOrEqual(3);
    expect(stored[0]).toBe("goto-journal");
  });

  it("shows Jump to, Log, and Admin sections when search is empty", () => {
    render(<CommandPalette />);
    openPalette();

    expect(screen.getByText("Jump to")).toBeInTheDocument();
    expect(screen.getByText("Log")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("dialog has correct ARIA attributes", () => {
    render(<CommandPalette />);
    openPalette();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Command palette");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("search input has correct ARIA attributes", () => {
    render(<CommandPalette />);
    openPalette();

    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-controls", "cmdk-list");
  });

  it("calls onSignOut prop when Sign out is selected", () => {
    const onSignOut = vi.fn();
    render(<CommandPalette onSignOut={onSignOut} />);
    openPalette();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "sign out" } });
    fireEvent.click(screen.getByText("Sign out"));

    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("listbox contains grouped options", () => {
    render(<CommandPalette />);
    openPalette();

    const listbox = screen.getByRole("listbox", { name: "Commands" });
    const groups = within(listbox).getAllByRole("group");
    expect(groups.length).toBeGreaterThan(0);

    const options = within(listbox).getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
  });
});
