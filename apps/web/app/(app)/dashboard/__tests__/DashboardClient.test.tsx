import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
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
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
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
      return mockRecipientsChain([]);
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
      // care_recipients
      return mockRecipientsChain([{ id: "rec-1" }]);
    });

    render(<DashboardClient user={mockUser} />);
    await waitFor(() =>
      expect(screen.getByText("The Smith Family")).toBeInTheDocument(),
    );
    expect(screen.getByText("View care journal")).toBeInTheDocument();
  });
});
