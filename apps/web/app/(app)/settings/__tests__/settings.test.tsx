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

// GrowCareSyncSection (UX-039a) + HistoryExportLink (TD-159) call createClient —
// hoisted refs so individual tests can vary the user / memberships response.
const { mockSupabaseGetUser, mockMembershipsResult } = vi.hoisted(() => ({
  mockSupabaseGetUser: vi.fn().mockResolvedValue({ data: { user: null } }),
  mockMembershipsResult: { value: { data: [] as unknown[] } },
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getUser: mockSupabaseGetUser,
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      limit: vi
        .fn()
        .mockImplementation(() => Promise.resolve(mockMembershipsResult.value)),
    }),
  }),
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

describe("SettingsPage — rapid-click protection (TD-97)", () => {
  it("ProfileSection: save button disabled and shows Saving… while updateProfile isPending", async () => {
    const mockMutateAsync = vi.fn(() => new Promise(() => {})); // never resolves
    vi.mocked(trpc.user.updateProfile.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
      error: null,
    } as any);

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
    vi.mocked(trpc.user.updateNotifications.useMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
      isPending: false,
      isError: false,
      error: null,
      data: { ok: true },
    } as any);
    vi.mocked(trpc.useUtils).mockReturnValue({
      user: { getProfile: { invalidate: vi.fn() } },
    } as any);

    render(<SettingsPage />);
    // When isPending=true the button text changes to "Saving…" and becomes disabled
    const saveBtn = screen.getByRole("button", { name: /saving/i });
    expect(saveBtn).toBeDisabled();
    // Rapid clicks should not call mutateAsync (button is already disabled)
    for (let i = 0; i < 5; i++) fireEvent.click(saveBtn);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("NotificationsSection: email toggle disabled while updateNotifications.isPending", async () => {
    const mockMutateAsync = vi.fn(() => new Promise(() => {})); // never resolves
    vi.mocked(trpc.user.updateNotifications.useMutation).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
      error: null,
      data: undefined,
    } as any);
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
    vi.mocked(trpc.useUtils).mockReturnValue({
      user: { getProfile: { invalidate: vi.fn() } },
    } as any);

    render(<SettingsPage />);
    const digestToggle = screen.getByRole("switch", {
      name: /weekly digest email/i,
    });
    // All email toggles should be disabled while mutation is pending
    expect(digestToggle).toBeDisabled();
    // Rapid clicks should not fire additional calls
    for (let i = 0; i < 5; i++) fireEvent.click(digestToggle);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});

// ─── TD-159: HistoryExportLink role gating ──────────────────────────────────

describe("SettingsPage - HistoryExportLink (TD-159)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub the trpc + push notification hooks so the page renders without warnings.
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
    vi.mocked(trpc.user.updateNotifications.useMutation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
      isPending: false,
      isError: false,
      error: null,
      data: { ok: true },
    } as any);
    vi.mocked(trpc.useUtils).mockReturnValue({
      user: { getProfile: { invalidate: vi.fn() } },
    } as any);
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
  });

  it("renders the Export care history link for a coordinator", async () => {
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockMembershipsResult.value = { data: [{ role: "coordinator" }] };

    render(<SettingsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /export full care history/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /export full care history/i }),
    ).toHaveAttribute("href", "/settings/history-export");
  });

  it("hides the link for a non-coordinator (empty memberships query result)", async () => {
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: { id: "user-2" } },
    });
    mockMembershipsResult.value = { data: [] };

    render(<SettingsPage />);

    // Wait long enough for the effect to complete + render; link must NOT appear.
    await waitFor(() => {
      // Some other element from the page must be present (sanity check render)
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("link", { name: /export full care history/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the link for a signed-out user", async () => {
    mockSupabaseGetUser.mockResolvedValue({ data: { user: null } });
    mockMembershipsResult.value = { data: [] };

    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("link", { name: /export full care history/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT leak the '(coordinators only)' sub-label anywhere on the page", async () => {
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: { id: "user-3" } },
    });
    mockMembershipsResult.value = { data: [{ role: "coordinator" }] };

    render(<SettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /export full care history/i }),
      ).toBeInTheDocument();
    });
    // The disclosure copy is removed — coordinators see the link, non-coords don't see anything.
    expect(screen.queryByText(/coordinators only/i)).not.toBeInTheDocument();
  });
});
