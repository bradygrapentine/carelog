import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardClient } from "../DashboardClient";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const { mockFrom, mockPush } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/components/dashboard/MoodCard", () => ({
  MoodCard: () => null,
}));
  
vi.mock("@/components/dashboard/BriefHero", () => ({
  BriefHero: () => null,
}));

vi.mock("@/components/dashboard/MedCard", () => ({
  MedCard: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: "user-1", email: "caregiver@example.com" } as any;

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

const mockDisplayNamesChain = (fullName: string | null) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({
    data: fullName ? { full_name: fullName } : null,
  }),
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

function setupTeams(
  teams: Array<{
    orgId: string;
    orgName: string;
    recipientId: string;
    recipientName?: string;
  }>,
) {
  let careEventsCallCount = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "memberships") {
      return mockMembershipsChain(
        teams.map((t) => ({
          org_id: t.orgId,
          recipient_id: t.recipientId,
          role: "caregiver",
          organizations: { id: t.orgId, name: t.orgName },
        })),
      );
    }
    if (table === "display_names") {
      return mockDisplayNamesChain(teams[0]?.recipientName ?? null);
    }
    if (table === "care_events") {
      careEventsCallCount++;
      return careEventsCallCount === 1
        ? mockCareEventsCountChain()
        : mockCareEventsEarliestChain("2025-01-01T00:00:00Z");
    }
    // care_recipients — return first matching recipient
    const team = teams[0];
    return mockRecipientsChain(team ? [{ id: team.recipientId }] : []);
  });
}

function setupNoTeams() {
  mockFrom.mockImplementation((table: string) => {
    if (table === "memberships") return mockMembershipsChain([]);
    if (table === "care_events") return mockCareEventsCountChain();
    if (table === "care_recipients") return mockRecipientsChain([]);
    return mockCareEventsEarliestChain(null);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("DashboardClient (flow)", () => {
  it("loads and displays journal CTA after data loads (UX-039a Layout A)", async () => {
    setupTeams([
      {
        orgId: "org-1",
        orgName: "Smith Family",
        recipientId: "rec-1",
        recipientName: "Margaret Smith",
      },
    ]);

    render(<DashboardClient user={MOCK_USER} />);

    // Initially shows skeleton loading state
    expect(document.querySelector(".animate-pulse")).toBeTruthy();

    // After data loads, the heading uses recipient first name
    await waitFor(() => {
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent("Caring for Margaret");
    });
    // Journal CTA is accessible by aria-label (org name in the label)
    expect(
      screen.getByLabelText("Open care journal for Smith Family"),
    ).toBeInTheDocument();
  });

  it("renders journal link as a keyboard-reachable link", async () => {
    setupTeams([
      {
        orgId: "org-1",
        orgName: "Smith Family",
        recipientId: "rec-42",
        recipientName: "Margaret Smith",
      },
    ]);

    render(<DashboardClient user={MOCK_USER} />);

    await waitFor(() => {
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent("Caring for Margaret");
    });

    // C-1: journal CTA is a real <Link> (anchor) — keyboard accessible.
    const link = screen.getByRole("link", {
      name: /open care journal for smith family/i,
    });
    expect(link).toHaveAttribute("href", "/journal/rec-42");
    // Visible focus ring class is present
    expect(link.className).toMatch(/focus:ring-/);
  });

  it("shows 'Set up a care team' link for a new user with no teams", async () => {
    setupNoTeams();

    render(<DashboardClient user={MOCK_USER} />);

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Set up a care team" }),
      ).toBeInTheDocument(),
    );

    const link = screen.getByRole("link", { name: "Set up a care team" });
    expect(link).toHaveAttribute("href", "/onboarding");
  });

  it("pending invite from sessionStorage triggers redirect to invite URL", async () => {
    sessionStorage.setItem("pending_invite", "token-xyz");

    render(<DashboardClient user={MOCK_USER} />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/invite/token-xyz");
    });

    // Token is consumed — should be removed from sessionStorage
    expect(sessionStorage.getItem("pending_invite")).toBeNull();
  });
});
