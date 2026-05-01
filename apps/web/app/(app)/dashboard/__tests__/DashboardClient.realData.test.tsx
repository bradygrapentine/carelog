import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardClient } from "../DashboardClient";

// Real-data integration test — does NOT mock the three dashboard cards. Verifies
// that DashboardClient threads `recipientId` / `orgId` from the primary team into
// BriefHero, MedCard, MoodCard, AND that mocked tRPC responses render through.
//
// The card-mocked variants in DashboardClient.test.tsx and
// DashboardClient.flow.test.tsx exist to test orthogonal concerns (membership
// loading, master/detail layout). Keep both; this file is the integration glue.

// ─── Supabase ────────────────────────────────────────────────────────────────
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

// ─── tRPC ────────────────────────────────────────────────────────────────────
// Mirror the BriefHero/MedCard/MoodCard mock surface — every query/mutation/utils
// hook each card touches must exist or the import-time call throws.

// vi.hoisted() so the spies exist before the vi.mock factory runs.
const trpcMocks = vi.hoisted(() => ({
  briefQuery: vi.fn(),
  medsScheduledQuery: vi.fn(),
  medsTodayLogQuery: vi.fn(),
  moodSparklineQuery: vi.fn(),
  todayLogInvalidate: vi.fn(),
  logAdministrationMutate: vi.fn(),
}));

const {
  briefQuery,
  medsScheduledQuery,
  medsTodayLogQuery,
  moodSparklineQuery,
} = trpcMocks;

vi.mock("@/lib/trpc", () => ({
  trpc: {
    briefs: {
      latestForRecipient: {
        useQuery: (...args: unknown[]) => trpcMocks.briefQuery(...args),
      },
    },
    medications: {
      listScheduled: {
        useQuery: (...args: unknown[]) => trpcMocks.medsScheduledQuery(...args),
      },
      todayLog: {
        useQuery: (...args: unknown[]) => trpcMocks.medsTodayLogQuery(...args),
        invalidate: trpcMocks.todayLogInvalidate,
      },
      weekData: {
        useQuery: () => ({
          data: { schedules: [], events: [] },
          isLoading: false,
          isError: false,
        }),
      },
      logAdministration: {
        useMutation: () => ({
          mutate: trpcMocks.logAdministrationMutate,
          isPending: false,
        }),
      },
    },
    moodEntries: {
      sparkline: {
        useQuery: (...args: unknown[]) => trpcMocks.moodSparklineQuery(...args),
      },
    },
    useUtils: () => ({
      medications: { todayLog: { invalidate: trpcMocks.todayLogInvalidate } },
    }),
  },
}));

// ─── Supabase chain helpers (lifted from DashboardClient.test.tsx) ───────────
const ORG_ID = "00000000-0000-0000-0000-0000000000aa";
const RECIPIENT_ID = "00000000-0000-0000-0000-0000000000bb";

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

const mockUser = { id: "user-real-data", email: "test@example.com" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();

  // Single-team membership — Layout A renders BriefHero/MedCard/MoodCard inline.
  let careEventsCallCount = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "memberships") {
      return mockMembershipsChain([
        {
          org_id: ORG_ID,
          recipient_id: RECIPIENT_ID,
          role: "caregiver",
          organizations: { id: ORG_ID, name: "The Smith Family" },
        },
      ]);
    }
    if (table === "display_names") {
      return mockDisplayNamesChain("Eleanor Smith");
    }
    if (table === "care_events") {
      careEventsCallCount += 1;
      return careEventsCallCount === 1
        ? mockCareEventsCountChain()
        : mockCareEventsEarliestChain("2026-01-01T00:00:00Z");
    }
    if (table === "care_recipients") {
      return mockRecipientsChain([{ id: RECIPIENT_ID }]);
    }
    return mockCareEventsEarliestChain(null);
  });

  // Brief — single sample brief, headline drives BriefHero's main render.
  briefQuery.mockReturnValue({
    data: {
      id: "00000000-0000-0000-0000-0000000000c1",
      title: "Eleanor had a settled night",
      content: { medications: [], recent_entries: [] },
      includes: ["medications"],
      created_at: "2026-04-28T07:02:00.000Z",
    },
    isLoading: false,
    isError: false,
  });

  // Medications — one scheduled dose, no log yet (renders med-row + name).
  medsScheduledQuery.mockReturnValue({
    data: [
      {
        id: "schedule-1",
        scheduled_time: "08:00:00",
        medications: {
          id: "med-1",
          drug_name: "Lisinopril",
          dosage: "10mg",
        },
      },
    ],
    isLoading: false,
    isError: false,
  });
  medsTodayLogQuery.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  });

  // Mood sparkline — hasData true, today's label drives MoodCard's main render.
  moodSparklineQuery.mockReturnValue({
    data: {
      hasData: true,
      bars: Array.from({ length: 13 }, (_, i) => (i + 1) / 13),
      todayLabel: "Mood: calm",
      trendSummary: "Mood trending up over 13 days",
    },
    isLoading: false,
    isError: false,
  });
});

describe("DashboardClient — real-data integration", () => {
  it("renders BriefHero, MedCard, MoodCard with their tRPC content for the primary team", async () => {
    render(<DashboardClient user={mockUser} />);

    // Wait for Layout A heading to appear — recipient name in .headline-display h1.
    await waitFor(() => {
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent("Caring for Eleanor");
    });

    // BriefHero — real headline (not the empty/skeleton fallback).
    await waitFor(() =>
      expect(
        screen.getByText(/Eleanor had a settled night/i),
      ).toBeInTheDocument(),
    );

    // MedCard — drug_name from listScheduled. UX-081 mounted MedAttentionHero
    // which also renders the med name when the dose is past-due, so there may
    // be more than one occurrence in the DOM.
    expect(screen.getAllByText(/Lisinopril/i).length).toBeGreaterThan(0);

    // MoodCard — todayLabel from sparkline.
    expect(screen.getByTestId("mood-label")).toHaveTextContent("Mood: calm");

    // Verify the queries were called with the team's ids — proves the props
    // threaded through, not just that mocks returned data unconditionally.
    expect(briefQuery).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: RECIPIENT_ID, orgId: ORG_ID }),
      expect.objectContaining({ enabled: true }),
    );
    expect(medsScheduledQuery).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: ORG_ID, recipient_id: RECIPIENT_ID }),
      expect.objectContaining({ enabled: true }),
    );
    expect(moodSparklineQuery).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: RECIPIENT_ID, orgId: ORG_ID }),
      expect.objectContaining({ enabled: true }),
    );
  });
});
