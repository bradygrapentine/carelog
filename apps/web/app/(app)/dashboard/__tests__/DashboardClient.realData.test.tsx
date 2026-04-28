import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardClient } from "../DashboardClient";
import { trpc } from "@/lib/trpc";

// Integration test for #244/245/246 wiring: DashboardClient must thread the
// primary team's recipientId/orgId into BriefHero/MedCard/MoodCard, and each
// card must render its real-data content. Cards are NOT mocked here — that's
// the whole point. Sibling DashboardClient.test.tsx keeps its card-mocks for
// teams-list concerns.

const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      medications: { todayLog: { invalidate: vi.fn() } },
    }),
    briefs: {
      latestForRecipient: { useQuery: vi.fn() },
    },
    medications: {
      listScheduled: { useQuery: vi.fn() },
      todayLog: { useQuery: vi.fn() },
      logAdministration: { useMutation: vi.fn() },
    },
    moodEntries: {
      sparkline: { useQuery: vi.fn() },
    },
  },
}));

const mockUser = { id: "user-123", email: "test@example.com" } as any;

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

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

  let careEventsCallCount = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "memberships") {
      return mockMembershipsChain([
        {
          org_id: ORG_ID,
          recipient_id: REC_ID,
          organizations: { id: ORG_ID, name: "The Smith Family" },
        },
      ]);
    }
    if (table === "care_events") {
      careEventsCallCount++;
      return careEventsCallCount === 1
        ? mockCareEventsCountChain()
        : mockCareEventsEarliestChain("2025-01-01T00:00:00Z");
    }
    if (table === "care_recipients")
      return mockRecipientsChain([{ id: REC_ID }]);
    return mockCareEventsEarliestChain(null);
  });

  vi.mocked(trpc.briefs.latestForRecipient.useQuery).mockReturnValue({
    data: {
      id: "brief-1",
      title: "Eleanor had a settled night",
      content: {
        medications: [
          { drug_name: "Lisinopril", dosage: "10mg", instructions: "daily" },
        ],
        recent_entries: [{ mood: "calm", text: "She ate well today." }],
      },
      includes: ["medications", "journal"],
      created_at: "2026-04-28T07:02:00.000Z",
    },
    isLoading: false,
    isError: false,
  } as any);

  vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({
    data: [
      {
        id: "sched-1",
        scheduled_time: "08:00:00",
        medications: { id: "med-1", drug_name: "Lisinopril", dosage: "10mg" },
      },
    ],
    isLoading: false,
    isError: false,
  } as any);

  vi.mocked(trpc.medications.todayLog.useQuery).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  } as any);

  vi.mocked(trpc.medications.logAdministration.useMutation).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as any);

  vi.mocked(trpc.moodEntries.sparkline.useQuery).mockReturnValue({
    data: {
      hasData: true,
      bars: [0.4, 0.5, 0.6, 0.7, 0.8, 0.7, 0.6, 0.5, 0.4, 0.5, 0.6, 0.7, 0.8],
      todayLabel: "calm",
      trendSummary: "Mood has been steady",
    },
    isLoading: false,
    isError: false,
  } as any);
});

describe("DashboardClient — real-data integration", () => {
  it("threads primary team identifiers into BriefHero, MedCard, MoodCard and renders their real-data content", async () => {
    render(<DashboardClient user={mockUser} />);

    await waitFor(() =>
      expect(screen.getByText("The Smith Family")).toBeInTheDocument(),
    );

    // BriefHero — real-data title
    expect(
      await screen.findByText("Eleanor had a settled night"),
    ).toBeInTheDocument();

    // MedCard — scheduled drug surfaces
    expect(screen.getAllByText(/Lisinopril/i).length).toBeGreaterThan(0);

    // MoodCard — real-data label + sparkline (13 bars)
    expect(screen.getByTestId("mood-label")).toHaveTextContent("calm");
    expect(screen.getAllByTestId("mood-bar")).toHaveLength(13);

    // Each tRPC query was called with the primary team's identifiers (proves
    // the prop threading from #243's master/detail layout is correct).
    const briefCallArgs = vi.mocked(trpc.briefs.latestForRecipient.useQuery)
      .mock.calls[0]?.[0];
    expect(briefCallArgs).toMatchObject({
      recipientId: REC_ID,
      orgId: ORG_ID,
    });

    const medsCallArgs = vi.mocked(trpc.medications.listScheduled.useQuery).mock
      .calls[0]?.[0];
    expect(medsCallArgs).toMatchObject({
      recipient_id: REC_ID,
      org_id: ORG_ID,
    });

    const moodCallArgs = vi.mocked(trpc.moodEntries.sparkline.useQuery).mock
      .calls[0]?.[0];
    expect(moodCallArgs).toMatchObject({
      recipientId: REC_ID,
      orgId: ORG_ID,
    });
  });
});
