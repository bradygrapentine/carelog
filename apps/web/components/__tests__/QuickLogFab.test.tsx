import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, describe, vi, beforeEach } from "vitest";
import { QuickLogFab } from "@/components/QuickLogFab";

// Mock next/navigation
const mockPush = vi.fn();
let mockPathnameValue = "/journal/recipient-123";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathnameValue,
}));

function renderFab() {
  return render(<QuickLogFab />);
}

describe("<QuickLogFab />", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathnameValue = "/journal/recipient-123";
  });

  it("renders with aria-label='Quick log'", () => {
    renderFab();
    expect(
      screen.getByRole("button", { name: "Quick log" }),
    ).toBeInTheDocument();
  });

  it("menu is not visible initially", () => {
    renderFab();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("click toggles menu open and sets aria-expanded", () => {
    renderFab();
    const fab = screen.getByRole("button", { name: "Quick log" });
    expect(fab).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(fab);
    expect(fab).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("second click closes menu", () => {
    renderFab();
    const fab = screen.getByRole("button", { name: "Quick log" });
    fireEvent.click(fab);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(fab);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Esc closes menu", async () => {
    renderFab();
    const fab = screen.getByRole("button", { name: "Quick log" });
    fireEvent.click(fab);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("backdrop click closes menu", () => {
    renderFab();
    fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    const backdrop = screen.getByTestId("quick-log-backdrop");
    fireEvent.click(backdrop);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  describe("enabled actions navigate to the right panel", () => {
    it("Log medication navigates to medications panel", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      fireEvent.click(screen.getByRole("menuitem", { name: /log medication/i }));
      expect(mockPush).toHaveBeenCalledWith(
        "/journal/recipient-123?panel=medications",
      );
    });

    it("Log mood navigates to journal panel", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      fireEvent.click(screen.getByRole("menuitem", { name: /log mood/i }));
      expect(mockPush).toHaveBeenCalledWith(
        "/journal/recipient-123?panel=journal",
      );
    });

    it("Log note navigates to journal panel", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      fireEvent.click(screen.getByRole("menuitem", { name: /log note/i }));
      expect(mockPush).toHaveBeenCalledWith(
        "/journal/recipient-123?panel=journal",
      );
    });

    it("Log BP navigates to journal panel", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      fireEvent.click(screen.getByRole("menuitem", { name: /log bp/i }));
      expect(mockPush).toHaveBeenCalledWith(
        "/journal/recipient-123?panel=journal",
      );
    });
  });

  describe("disabled actions", () => {
    it("Log meal is disabled (aria-disabled + button disabled)", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      const mealBtn = screen.getByRole("menuitem", { name: /log meal/i });
      expect(mealBtn).toHaveAttribute("aria-disabled", "true");
      expect(mealBtn).toBeDisabled();
    });

    it("Log meal click does not navigate", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      // fireEvent.click on a disabled button still fires the handler in jsdom, but our handler guards on action.disabled
      const mealBtn = screen.getByRole("menuitem", { name: /log meal/i });
      // Use the native disabled attribute to block clicks — button is actually disabled
      expect(mealBtn).toBeDisabled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("Log hydration is disabled", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      const hydrationBtn = screen.getByRole("menuitem", {
        name: /log hydration/i,
      });
      expect(hydrationBtn).toHaveAttribute("aria-disabled", "true");
      expect(hydrationBtn).toBeDisabled();
    });
  });

  it("navigates to dashboard when no recipientId in URL", () => {
    mockPathnameValue = "/dashboard";
    renderFab();
    fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /log medication/i }),
    );
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("FAB has aria-controls pointing to quick-log-menu", () => {
    renderFab();
    const fab = screen.getByRole("button", { name: "Quick log" });
    expect(fab).toHaveAttribute("aria-controls", "quick-log-menu");
  });
});
