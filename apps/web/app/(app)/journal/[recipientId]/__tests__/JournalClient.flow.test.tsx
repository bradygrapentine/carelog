import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { JournalClient } from "../JournalClient";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock authenticatedFetch — used for /api/journal and /api/members.
// Default returns a coordinator member so JournalEntryForm is visible.
const mockAuthFetch = vi.fn().mockImplementation(async (url: string) => {
  if (typeof url === "string" && url.includes("members")) {
    return {
      json: async () => ({
        members: [
          {
            id: "m1",
            role: "coordinator",
            user_id: "user-1",
            display_name: null,
            email: null,
          },
        ],
      }),
    };
  }
  return { json: async () => ({ events: [] }) };
});

vi.mock("@/lib/authenticatedFetch", () => ({
  get authenticatedFetch() {
    return mockAuthFetch;
  },
}));

// Mock supabase createClient
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

// Mock next/navigation
const mockGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockGet }),
  usePathname: () => "/journal/r1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock all child panels to keep tests focused on routing
vi.mock("../JournalEntryForm", () => ({
  JournalEntryForm: () => <div data-testid="journal-entry-form" />,
}));
vi.mock("../JournalTimeline", () => ({
  JournalTimeline: () => <div data-testid="journal-timeline" />,
}));
vi.mock("../MedicationPanel", () => ({
  MedicationPanel: () => <div data-testid="medication-panel" />,
}));
vi.mock("../MedicationChecklist", () => ({
  MedicationChecklist: () => <div data-testid="medication-checklist" />,
}));
vi.mock("../TeamPanel", () => ({
  TeamPanel: () => <div data-testid="team-panel" />,
}));
vi.mock("../ShiftForm", () => ({
  ShiftForm: () => <div data-testid="shift-form" />,
}));
vi.mock("../ShiftList", () => ({
  ShiftList: () => <div data-testid="shift-list" />,
}));
vi.mock("../DocumentVault", () => ({
  DocumentVault: () => <div data-testid="document-vault" />,
}));
vi.mock("../OcrReviewPanel", () => ({
  OcrReviewPanel: () => <div data-testid="ocr-review-panel" />,
}));
vi.mock("../OuterCirclePanel", () => ({
  OuterCirclePanel: () => <div data-testid="outer-circle-panel" />,
}));
vi.mock("../SymptomPanel", () => ({
  SymptomPanel: () => <div data-testid="symptom-panel" />,
}));
vi.mock("../BurnoutCheckin", () => ({
  BurnoutCheckin: () => <div data-testid="burnout-checkin" />,
}));
vi.mock("../ExpensePanel", () => ({
  ExpensePanel: () => <div data-testid="expense-panel" />,
}));
vi.mock("../EolPlanner", () => ({
  EolPlanner: () => <div data-testid="eol-planner" />,
}));
vi.mock("../BenefitsNavigator", () => ({
  BenefitsNavigator: () => <div data-testid="benefits-navigator" />,
}));
vi.mock("../ExportButton", () => ({
  ExportButton: () => <div data-testid="export-button" />,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: "user-1", email: "caregiver@example.com" };
const MOCK_ORG = { id: "org-1", name: "Smith Family" };

function setupAuth(user: typeof MOCK_USER | null = MOCK_USER) {
  mockGetUser.mockResolvedValue({ data: { user } });

  // supabase.from('care_recipients').select(...).eq(...).single()
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { org_id: MOCK_ORG.id, organizations: MOCK_ORG },
    }),
  };
  mockFrom.mockReturnValue(selectChain);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("JournalClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue(null); // default: no ?panel= param

    // Restore default authenticatedFetch implementation after clearAllMocks
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("members")) {
        return {
          json: async () => ({
            members: [
              {
                id: "m1",
                role: "coordinator",
                user_id: "user-1",
                display_name: null,
                email: null,
              },
            ],
          }),
        };
      }
      return { json: async () => ({ events: [] }) };
    });
  });

  it("shows a loading spinner initially", () => {
    // Auth resolves slowly — capture the pending promise
    mockGetUser.mockReturnValue(new Promise(() => {}));
    render(<JournalClient recipientId="r1" />);
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders the journal panel by default when no ?panel= param is set", async () => {
    mockGet.mockReturnValue(null);
    setupAuth();
    render(<JournalClient recipientId="r1" />);

    await waitFor(() => {
      expect(screen.getByTestId("journal-entry-form")).toBeInTheDocument();
      expect(screen.getByTestId("journal-timeline")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("medication-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("team-panel")).not.toBeInTheDocument();
  });

  it("renders the medications panel when ?panel=medications", async () => {
    mockGet.mockReturnValue("medications");
    setupAuth();
    render(<JournalClient recipientId="r1" />);

    await waitFor(() => {
      expect(screen.getByTestId("medication-panel")).toBeInTheDocument();
      expect(screen.getByTestId("medication-checklist")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("journal-entry-form")).not.toBeInTheDocument();
  });

  it("renders the team panel when ?panel=team", async () => {
    mockGet.mockReturnValue("team");
    setupAuth();
    render(<JournalClient recipientId="r1" />);

    await waitFor(() => {
      expect(screen.getByTestId("team-panel")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("journal-entry-form")).not.toBeInTheDocument();
  });

  it("falls back to journal panel for an invalid ?panel= value", async () => {
    mockGet.mockReturnValue("invalid-panel");
    setupAuth();
    render(<JournalClient recipientId="r1" />);

    await waitFor(() => {
      expect(screen.getByTestId("journal-entry-form")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("medication-panel")).not.toBeInTheDocument();
  });

  it("hides JournalEntryForm for supporter role and shows read-only notice", async () => {
    mockGet.mockReturnValue(null);
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });

    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { org_id: MOCK_ORG.id, organizations: MOCK_ORG },
      }),
    };
    mockFrom.mockReturnValue(selectChain);

    // Override authenticatedFetch to return supporter role
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("members")) {
        return {
          json: async () => ({
            members: [
              {
                id: "m1",
                role: "supporter",
                user_id: MOCK_USER.id,
                display_name: null,
                email: null,
              },
            ],
          }),
        } as Response;
      }
      return { json: async () => ({ events: [] }) } as Response;
    });

    render(<JournalClient recipientId="r1" />);

    await waitFor(() => {
      expect(
        screen.queryByTestId("journal-entry-form"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(/You're here as a Supporter/),
      ).toBeInTheDocument();
    });
  });

  it("shows the top-bar with org name and user email after auth resolves", async () => {
    mockGet.mockReturnValue(null);
    setupAuth();
    render(<JournalClient recipientId="r1" />);

    await waitFor(() => {
      expect(screen.getByTestId("top-bar")).toBeInTheDocument();
      expect(screen.getByText("Smith Family")).toBeInTheDocument();
      expect(screen.getByText("caregiver@example.com")).toBeInTheDocument();
    });
  });

  it("redirects to /signin when auth returns no user", async () => {
    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
    mockGetUser.mockResolvedValue({ data: { user: null } });

    render(<JournalClient recipientId="r1" />);

    await waitFor(() => {
      expect(window.location.href).toBe("/signin");
    });
  });
});
