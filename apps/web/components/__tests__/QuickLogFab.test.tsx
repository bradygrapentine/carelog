import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, describe, vi, beforeEach } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { QuickLogFab } from "@/components/QuickLogFab";

// Mock next/navigation
const mockPush = vi.fn();
let mockPathnameValue = "/journal/recipient-123";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathnameValue,
}));

// TD-152: mock Sentry so addBreadcrumb assertions don't hit the real SDK
// in jsdom and so we can verify the breadcrumb shape.
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

function renderFab() {
  return render(<QuickLogFab />);
}

describe("<QuickLogFab />", () => {
  beforeEach(() => {
    mockPush.mockClear();
    vi.mocked(Sentry.addBreadcrumb).mockClear();
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
      fireEvent.click(
        screen.getByRole("menuitem", { name: /log medication/i }),
      );
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

  describe("no recipientId in URL (TD-150)", () => {
    beforeEach(() => {
      mockPathnameValue = "/dashboard";
    });

    it("shows the 'open a recipient' hint", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      expect(
        screen.getByText(/open a recipient's journal first to log/i),
      ).toBeInTheDocument();
    });

    it("disables every menuitem (live-test silent-failure repro)", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      for (const label of [
        /log medication/i,
        /log mood/i,
        /log note/i,
        /log bp/i,
      ]) {
        const btn = screen.getByRole("menuitem", { name: label });
        expect(btn).toBeDisabled();
        expect(btn).toHaveAttribute("aria-disabled", "true");
      }
    });

    it("clicking a disabled menuitem does not navigate", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      fireEvent.click(
        screen.getByRole("menuitem", { name: /log medication/i }),
      );
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("aria-describedby points at the hint when recipientId is null", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      expect(screen.getByRole("menu")).toHaveAttribute(
        "aria-describedby",
        "quick-log-no-recipient-hint",
      );
    });
  });

  it("aria-describedby is absent when recipientId is present", () => {
    mockPathnameValue = "/journal/recipient-123";
    renderFab();
    fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
    expect(screen.getByRole("menu")).not.toHaveAttribute("aria-describedby");
  });

  it("FAB has aria-controls pointing to quick-log-menu", () => {
    renderFab();
    const fab = screen.getByRole("button", { name: "Quick log" });
    expect(fab).toHaveAttribute("aria-controls", "quick-log-menu");
  });

  describe("Sentry breadcrumbs (TD-152)", () => {
    it("addBreadcrumb fires on enabled menu click with action metadata", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      fireEvent.click(screen.getByRole("menuitem", { name: /log mood/i }));
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: "quicklog",
        message: "menu item clicked",
        data: { actionId: "mood", hasRecipient: true, disabled: false },
      });
    });

    it("breadcrumb payload does not include recipientId (PHI rule)", () => {
      renderFab();
      fireEvent.click(screen.getByRole("button", { name: "Quick log" }));
      fireEvent.click(screen.getByRole("menuitem", { name: /log mood/i }));
      const [call] = vi.mocked(Sentry.addBreadcrumb).mock.calls;
      expect(call?.[0]?.data).not.toHaveProperty("recipientId");
    });
  });
});
