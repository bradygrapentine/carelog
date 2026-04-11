import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DashboardClient } from "../DashboardClient";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

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

function setupTeams(
  teams: Array<{ orgId: string; orgName: string; recipientId: string }>,
) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "memberships") {
      return mockMembershipsChain(
        teams.map((t) => ({
          org_id: t.orgId,
          recipient_id: t.recipientId,
          organizations: { id: t.orgId, name: t.orgName },
        })),
      );
    }
    // care_recipients — return first matching recipient
    const team = teams[0];
    return mockRecipientsChain(team ? [{ id: team.recipientId }] : []);
  });
}

function setupNoTeams() {
  mockFrom.mockImplementation((table: string) => {
    if (table === "memberships") return mockMembershipsChain([]);
    return mockRecipientsChain([]);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  Object.defineProperty(window, "location", {
    writable: true,
    value: { href: "" },
  });
});

describe("DashboardClient (flow)", () => {
  it("loads and displays care team cards after data loads", async () => {
    setupTeams([
      { orgId: "org-1", orgName: "Smith Family", recipientId: "rec-1" },
    ]);

    render(<DashboardClient user={MOCK_USER} />);

    // Initially shows spinner
    expect(document.querySelector(".animate-spin")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Smith Family")).toBeInTheDocument();
    });
    expect(screen.getByText("View care journal")).toBeInTheDocument();
  });

  it("clicking a care team card navigates to the journal URL", async () => {
    setupTeams([
      { orgId: "org-1", orgName: "Smith Family", recipientId: "rec-42" },
    ]);

    render(<DashboardClient user={MOCK_USER} />);

    await waitFor(() =>
      expect(screen.getByText("Smith Family")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByText("Smith Family").closest("[class*='cursor-pointer']")!,
    );

    expect(window.location.href).toBe("/journal/rec-42");
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
      expect(window.location.href).toBe("/invite/token-xyz");
    });

    // Token is consumed — should be removed from sessionStorage
    expect(sessionStorage.getItem("pending_invite")).toBeNull();
  });
});
