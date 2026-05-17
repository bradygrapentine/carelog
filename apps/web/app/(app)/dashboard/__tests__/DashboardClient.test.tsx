import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import { DashboardClient } from "../DashboardClient";

// Mock Supabase client
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

// TD-152: mock Sentry so captureException assertions don't hit the real SDK
// in jsdom and so we can verify error-path observability.
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/dashboard/MoodCard", () => ({
  MoodCard: () => null,
}));

vi.mock("@/components/dashboard/BriefHero", () => ({
  BriefHero: () => null,
}));

vi.mock("@/components/brief/BriefSection", () => ({
  BriefSection: () => null,
}));

vi.mock("@/components/dashboard/MedCard", () => ({
  MedCard: () => null,
}));

// ReferralCard must NOT appear on the dashboard (moved to Settings in UX-039a)
vi.mock("@/components/dashboard/ReferralCard", () => ({
  ReferralCard: () => <div data-testid="referral-card" />,
}));

// RecipientSummaryCard — rendered in layout B
vi.mock("@/components/dashboard/RecipientSummaryCard", () => ({
  RecipientSummaryCard: ({ firstName }: { firstName: string }) => (
    <div data-testid={`recipient-summary-${firstName}`}>
      Caring for {firstName}
    </div>
  ),
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

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
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

  it("renders recipient-led heading (UX-039a) when no teams exist", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") return mockMembershipsChain([]);
      return mockRecipientsChain([]);
    });

    render(<DashboardClient user={mockUser} />);
    // With no teams, shows the fallback heading (no recipient name)
    await waitFor(() =>
      expect(screen.getByText("Your care dashboard")).toBeInTheDocument(),
    );
    // Old "Your care teams" heading must not appear
    expect(screen.queryByText("Your care teams")).not.toBeInTheDocument();
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
          "You're not on a care team yet. Set one up to start logging.",
        ),
      ).toBeInTheDocument(),
    );
  });

  it("renders 'Caring for {firstName}' h1 with .headline-display when recipient name is known", async () => {
    let careEventsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") {
        return mockMembershipsChain([
          {
            org_id: "org-1",
            recipient_id: "rec-1",
            role: "caregiver",
            organizations: { id: "org-1", name: "The Smith Family" },
          },
        ]);
      }
      if (table === "display_names") {
        return mockDisplayNamesChain("Margaret Smith");
      }
      if (table === "care_events") {
        careEventsCallCount++;
        return careEventsCallCount === 1
          ? mockCareEventsCountChain()
          : mockCareEventsEarliestChain("2025-01-01T00:00:00Z");
      }
      if (table === "care_recipients")
        return mockRecipientsChain([{ id: "rec-1" }]);
      return mockCareEventsEarliestChain(null);
    });

    render(<DashboardClient user={mockUser} />);
    // Heading must use .headline-display and contain the firstName in <em>
    await waitFor(() => {
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveClass("headline-display");
      expect(h1).toHaveTextContent("Caring for Margaret");
      const em = h1.querySelector("em");
      expect(em).toBeInTheDocument();
      expect(em).toHaveTextContent("Margaret");
    });
  });

  it("does not render ReferralCard on the dashboard (moved to Settings)", async () => {
    let careEventsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") {
        return mockMembershipsChain([
          {
            org_id: "org-1",
            recipient_id: "rec-1",
            role: "coordinator",
            organizations: { id: "org-1", name: "The Smith Family" },
          },
        ]);
      }
      if (table === "display_names") {
        return mockDisplayNamesChain("Margaret Smith");
      }
      if (table === "care_events") {
        careEventsCallCount++;
        return careEventsCallCount === 1
          ? mockCareEventsCountChain()
          : mockCareEventsEarliestChain("2025-01-01T00:00:00Z");
      }
      if (table === "care_recipients")
        return mockRecipientsChain([{ id: "rec-1" }]);
      return mockCareEventsEarliestChain(null);
    });

    render(<DashboardClient user={mockUser} />);
    await waitFor(() => {
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent("Caring for");
    });
    // ReferralCard must not be mounted on the dashboard
    expect(screen.queryByTestId("referral-card")).not.toBeInTheDocument();
  });

  it("shows open care journal link when a team exists", async () => {
    let careEventsCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") {
        return mockMembershipsChain([
          {
            org_id: "org-1",
            recipient_id: "rec-1",
            role: "caregiver",
            organizations: { id: "org-1", name: "The Smith Family" },
          },
        ]);
      }
      if (table === "display_names") {
        return mockDisplayNamesChain("Margaret Smith");
      }
      if (table === "care_events") {
        careEventsCallCount++;
        return careEventsCallCount === 1
          ? mockCareEventsCountChain()
          : mockCareEventsEarliestChain("2025-01-01T00:00:00Z");
      }
      if (table === "care_recipients")
        return mockRecipientsChain([{ id: "rec-1" }]);
      return mockCareEventsEarliestChain(null);
    });

    render(<DashboardClient user={mockUser} />);
    await waitFor(() =>
      expect(
        screen.getByLabelText("Open care journal for The Smith Family"),
      ).toBeInTheDocument(),
    );
  });

  // ── UX-039b: multi-recipient switcher + layout B + view toggle ─────────────

  // Tracks how many times care_recipients has been called to return different IDs
  function twoTeamMockFrom(nameForOrg1: string, nameForOrg2: string) {
    let displayNamesCallCount = 0;
    let recipientsCallCount = 0;
    let careEventsCallCount = 0;
    return (table: string) => {
      if (table === "memberships") {
        return mockMembershipsChain([
          {
            org_id: "org-1",
            recipient_id: "rec-1",
            role: "caregiver",
            organizations: { id: "org-1", name: "Johnson Family" },
          },
          {
            org_id: "org-2",
            recipient_id: "rec-2",
            role: "caregiver",
            organizations: { id: "org-2", name: "Williams Family" },
          },
        ]);
      }
      if (table === "care_recipients") {
        recipientsCallCount++;
        const id = recipientsCallCount === 1 ? "rec-1" : "rec-2";
        return mockRecipientsChain([{ id }]);
      }
      if (table === "display_names") {
        displayNamesCallCount++;
        const name = displayNamesCallCount === 1 ? nameForOrg1 : nameForOrg2;
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { full_name: name } }),
        };
      }
      if (table === "care_events") {
        // Alternate: even calls = count query, odd calls = earliest query
        // Promise.all calls from("care_events") twice (synchronously), then both resolve.
        careEventsCallCount++;
        return careEventsCallCount % 2 === 1
          ? mockCareEventsCountChain()
          : mockCareEventsEarliestChain(null);
      }
      return mockCareEventsEarliestChain(null);
    };
  }

  it("shows view toggle when N > 1 teams", async () => {
    mockFrom.mockImplementation(
      twoTeamMockFrom("Margaret Smith", "Robert Williams"),
    );

    render(<DashboardClient user={mockUser} />);

    // Wait for teams to load, then view toggle should appear
    await waitFor(() =>
      expect(screen.getByLabelText("Show all recipients")).toBeInTheDocument(),
    );
  });

  it("switching to stacked view renders layout B with recipient summary cards", async () => {
    mockFrom.mockImplementation(
      twoTeamMockFrom("Margaret Smith", "Robert Williams"),
    );

    render(<DashboardClient user={mockUser} />);

    // Wait for the toggle to appear, then click it
    await waitFor(() =>
      expect(screen.getByLabelText("Show all recipients")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByLabelText("Show all recipients"));

    // Layout B heading
    await waitFor(() =>
      expect(screen.getByText("Your care recipients")).toBeInTheDocument(),
    );

    // Toggle now shows "Single view" (aria-pressed=true on stacked)
    expect(
      screen.getByLabelText("Switch to single-recipient view"),
    ).toBeInTheDocument();

    // RecipientSummaryCard rendered for both recipients
    expect(
      screen.getByTestId("recipient-summary-Margaret"),
    ).toBeInTheDocument();
  });

  it(
    "clicking a switcher chip in layout A updates the page heading to the selected recipient",
    { timeout: 10000 },
    async () => {
      // Mock two teams with distinct names to verify switcher wiring
      mockFrom.mockImplementation(
        twoTeamMockFrom("Margaret Smith", "Robert Williams"),
      );

      render(<DashboardClient user={mockUser} />);

      // Wait for initial heading: "Caring for Margaret"
      await waitFor(
        () => {
          const h1 = screen.getByRole("heading", { level: 1 });
          expect(h1).toHaveTextContent("Caring for Margaret");
        },
        { timeout: 3000 },
      );

      // Click the "Robert" chip — it should be labeled with first name
      const robertChip = await waitFor(() =>
        screen.getByRole("button", { name: /robert/i }),
      );
      fireEvent.click(robertChip);

      // Heading should update to "Caring for Robert"
      await waitFor(() => {
        const h1 = screen.getByRole("heading", { level: 1 });
        expect(h1).toHaveTextContent("Caring for Robert");
      });
    },
  );

  describe("Sentry observability (TD-152)", () => {
    const mockCareEventsErrorChain = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi
        .fn()
        .mockResolvedValue({ count: null, error: { message: "RLS timeout" } }),
    });

    function setupErrorScenario() {
      let careEventsCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "memberships")
          return mockMembershipsChain([
            {
              org_id: "org-1",
              recipient_id: "r-1",
              role: "coordinator",
              organizations: { id: "org-1", name: "Test Team" },
            },
          ]);
        if (table === "care_recipients")
          return mockRecipientsChain([{ id: "r-1" }]);
        if (table === "display_names") return mockDisplayNamesChain("Robert");
        if (table === "care_events") {
          // Promise.all calls care_events twice — first count (errors), then earliest (ok)
          careEventsCallCount++;
          return careEventsCallCount === 1
            ? mockCareEventsErrorChain()
            : mockCareEventsEarliestChain(null);
        }
        return mockCareEventsEarliestChain(null);
      });
    }

    it("captures Sentry exception when care_events count query errors", async () => {
      setupErrorScenario();
      render(<DashboardClient user={mockUser} />);

      await waitFor(() => {
        expect(Sentry.captureException).toHaveBeenCalled();
      });

      const calls = vi.mocked(Sentry.captureException).mock.calls;
      const careEventsCall = calls.find(
        (c) =>
          (c[1] as { tags?: { path?: string } })?.tags?.path ===
          "care_events.count",
      );
      expect(careEventsCall).toBeDefined();
      expect(careEventsCall![1]).toMatchObject({
        tags: { component: "DashboardClient", path: "care_events.count" },
        contexts: { query: { orgId: "org-1", mode: "estimated" } },
      });
    });

    it("dashboard still renders when care_events count errors (no white-screen)", async () => {
      setupErrorScenario();
      render(<DashboardClient user={mockUser} />);

      await waitFor(() => {
        // Heading is "Caring for Robert" once the team loads; if rendering broke,
        // we'd see the loading skeleton or nothing.
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          /Caring for Robert|Your care dashboard/,
        );
      });
    });
  });

  describe("Network failure path (TD-165)", () => {
    it("catches a thrown network rejection, captures with path=network tag, and clears the loading state", async () => {
      // Force the first .from() call to reject — simulates DNS failure / fetch reject
      // (NOT the Supabase {data, error} envelope — an actual thrown rejection).
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockRejectedValue(new Error("network down")),
      }));

      render(<DashboardClient user={mockUser} />);

      await waitFor(() => {
        const calls = vi.mocked(Sentry.captureException).mock.calls;
        const networkCall = calls.find(
          (c) =>
            (c[1] as { tags?: { path?: string } })?.tags?.path === "network",
        );
        expect(networkCall).toBeDefined();
        expect(networkCall![1]).toMatchObject({
          tags: { component: "DashboardClient", path: "network" },
        });
      });

      // Skeleton must clear — `setLoading(false)` runs in finally even on throw.
      await waitFor(() => {
        expect(
          document.querySelector(".animate-pulse"),
        ).not.toBeInTheDocument();
      });
    });
  });
});
