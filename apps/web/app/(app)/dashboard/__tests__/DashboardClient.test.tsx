import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardClient } from "../DashboardClient";

// Mock Supabase client
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/dashboard/MoodCard", () => ({
  MoodCard: () => null,
}));

vi.mock("@/components/dashboard/MedCard", () => ({
  MedCard: () => null,
}));

const mockUser = {
  id: "user-123",
  email: "test@example.com",
} as any;

const mockMembershipsChain = (data: unknown) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  not: vi.fn().mockResolvedValue({ data }),
});

const mockRecipientsChain = (data: unknown) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data }),
});

const mockCareEventsCountChain = () => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockResolvedValue({ count: 5 }),
});

const mockCareEventsEarliestChain = (createdAt: string | null) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi
    .fn()
    .mockResolvedValue({ data: createdAt ? [{ created_at: createdAt }] : [] }),
});

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("DashboardClient", () => {
  it("shows loading state initially", () => {
    // Never resolves
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    render(<DashboardClient user={mockUser} />);
    // Loading state renders skeleton placeholders instead of a spinner
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders 'Your care teams' heading when user is authenticated", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") return mockMembershipsChain([]);
      return mockRecipientsChain([]);
    });

    render(<DashboardClient user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("Your care teams")).toBeInTheDocument(),
    );
  });

  it("shows empty state when no teams exist", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") return mockMembershipsChain([]);
      if (table === "care_events") return mockCareEventsCountChain();
      if (table === "care_recipients") return mockRecipientsChain([]);
      return mockCareEventsEarliestChain(null);
    });

    render(<DashboardClient user={mockUser} />);
    await waitFor(() =>
      expect(
        screen.getByText(
          "You do not have any care teams yet. Set one up to get started.",
        ),
      ).toBeInTheDocument(),
    );
  });

  it("shows care team cards when teams exist", async () => {
    let careEventsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") {
        return mockMembershipsChain([
          {
            org_id: "org-1",
            recipient_id: "rec-1",
            organizations: { id: "org-1", name: "The Smith Family" },
          },
        ]);
      }
      if (table === "care_events") {
        careEventsCallCount++;
        // First call is for count (with head: true)
        // Second call is for earliest date (with order)
        return careEventsCallCount === 1
          ? mockCareEventsCountChain()
          : mockCareEventsEarliestChain("2025-01-01T00:00:00Z");
      }
      if (table === "care_recipients")
        return mockRecipientsChain([{ id: "rec-1" }]);
      // Fallback
      return mockCareEventsEarliestChain(null);
    });

    render(<DashboardClient user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("The Smith Family")).toBeInTheDocument(),
    );
    expect(
      screen.getByLabelText("Open care journal for The Smith Family"),
    ).toBeInTheDocument();
  });
});
