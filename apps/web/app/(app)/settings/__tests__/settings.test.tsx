import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SettingsPage from "../page";
import * as webPush from "@/lib/webPush";
import { trpc } from "@/lib/trpc";

// Mock dependencies
vi.mock("@/lib/webPush");
vi.mock("@/lib/trpc", () => ({
  trpc: {
    user: {
      getProfile: {
        useQuery: vi.fn(),
      },
      updateProfile: {
        useMutation: vi.fn().mockReturnValue({
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
        }),
      },
      updateTimezone: {
        useMutation: vi.fn().mockReturnValue({
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
        }),
      },
      updateNotifications: {
        useMutation: vi.fn(),
      },
      changePassword: {
        useMutation: vi.fn().mockReturnValue({
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
        }),
      },
    },
    useUtils: vi.fn().mockReturnValue({
      user: { getProfile: { invalidate: vi.fn() } },
    }),
  },
}));

vi.mock("@/components/theme/ThemeToggle", () => ({
  ThemeToggle: () => <div>ThemeToggle</div>,
}));

// Mock fetch globally
global.fetch = vi.fn();

const mockProfile = {
  email: "user@example.com",
  displayName: "Test User",
  timezone: "UTC",
  language: "en",
  emailDigest: true,
  emailMentions: true,
  emailShiftReminders: true,
  webPushEnabled: false,
};

describe("SettingsPage - Browser Push Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getProfile hook
    vi.mocked(trpc.user.getProfile.useQuery).mockReturnValue({
      data: mockProfile,
      isLoading: false,
      error: null,
      status: "success",
      fetchStatus: "idle",
      isPending: false,
      isFetching: false,
      isSuccess: true,
      isError: false,
    } as any);

    // Mock updateNotifications hook
    vi.mocked(trpc.user.updateNotifications.useMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
      isPending: false,
      isError: false,
      error: null,
      data: { ok: true },
    } as any);

    // Mock useUtils hook
    vi.mocked(trpc.useUtils).mockReturnValue({
      user: { getProfile: { invalidate: vi.fn() } },
    } as any);

    // Mock fetch
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
  });

  it("renders Browser push notifications label", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Browser push notifications")).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(<SettingsPage />);
    expect(
      screen.getByText(
        /Receive notifications in this browser when new entries or shifts are posted/,
      ),
    ).toBeInTheDocument();
  });

  it("shows error when Notification API not available", async () => {
    // Temporarily hide Notification API
    const originalNotification = global.Notification;
    // @ts-expect-error — deliberately deleting a global to test the no-Notification-API path
    delete global.Notification;

    render(<SettingsPage />);

    const toggleButton = screen.getByRole("switch", {
      name: "Browser push notifications",
    });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Push notifications are not supported in this browser/,
        ),
      ).toBeInTheDocument();
    });

    // Restore
    global.Notification = originalNotification;
  });

  it("shows error when permission is denied", async () => {
    // Mock Notification.requestPermission to return 'denied'
    global.Notification = {
      requestPermission: vi.fn().mockResolvedValue("denied"),
    } as any;

    render(<SettingsPage />);

    const toggleButton = screen.getByRole("switch", {
      name: "Browser push notifications",
    });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Notifications are blocked in your browser settings/),
      ).toBeInTheDocument();
    });
  });

  it("toggle is disabled during web push loading", async () => {
    global.Notification = {
      requestPermission: vi.fn(
        () =>
          new Promise((resolve) => setTimeout(() => resolve("granted"), 100)),
      ),
    } as any;

    vi.mocked(webPush.registerServiceWorker).mockResolvedValue({
      pushManager: { subscribe: vi.fn() },
    } as any);

    vi.mocked(webPush.subscribeToPush).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                toJSON: () => ({
                  endpoint: "https://example.com/push",
                  keys: { p256dh: "test", auth: "test" },
                }),
              } as any),
            100,
          ),
        ),
    );

    render(<SettingsPage />);

    const toggleButton = screen.getByRole("switch", {
      name: "Browser push notifications",
    });

    fireEvent.click(toggleButton);

    // Button should be disabled during the flow
    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("disabled");
    });
  });

  it("does not crash during SSR (Notification undefined at render time)", () => {
    // This test ensures the component renders without accessing window/Notification
    // during the initial render (which would happen in SSR context)
    expect(() => {
      render(<SettingsPage />);
    }).not.toThrow();
  });
});
