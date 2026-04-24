import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoffSummary } from "../HandoffSummary";
import { trpc } from "@/lib/trpc";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockOnClose } = vi.hoisted(() => ({
  mockOnClose: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    careEvents: {
      timeline: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// buildHandoffSummary is the real implementation — no mock needed for the
// pure function; we control data via the tRPC mock.

// ─── Sample event factory ─────────────────────────────────────────────────────

function makeEvent(
  event_type: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: crypto.randomUUID(),
    org_id: "org-1",
    recipient_id: "rec-1",
    actor_id: "actor-a",
    event_type,
    entry_kind: "human",
    payload: {},
    flagged: false,
    occurred_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const SAMPLE_EVENTS = [
  makeEvent("medication"),
  makeEvent("journal", { payload: { text: "She ate well today.", mood: "good" } }),
  makeEvent("appointment"),
  makeEvent("symptom"),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderComponent(props: { open?: boolean; onClose?: () => void } = {}) {
  return render(
    <HandoffSummary
      open={props.open ?? true}
      onClose={props.onClose ?? mockOnClose}
      recipientId="rec-1"
    />,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("<HandoffSummary />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trpc.careEvents.timeline.useQuery).mockReturnValue({
      data: SAMPLE_EVENTS,
      isLoading: false,
    } as ReturnType<typeof trpc.careEvents.timeline.useQuery>);
  });

  describe("section headings", () => {
    it("renders Medications heading", () => {
      renderComponent();
      expect(screen.getByText("Medications")).toBeInTheDocument();
    });

    it("renders Moments heading", () => {
      renderComponent();
      expect(screen.getByText("Moments")).toBeInTheDocument();
    });

    it("renders Appointments heading", () => {
      renderComponent();
      expect(screen.getByText("Appointments")).toBeInTheDocument();
    });

    it("renders Concerns heading", () => {
      renderComponent();
      expect(screen.getByText("Concerns")).toBeInTheDocument();
    });

    it("renders Thanks to heading", () => {
      renderComponent();
      expect(screen.getByText("Thanks to")).toBeInTheDocument();
    });

    it("renders dialog title", () => {
      renderComponent();
      expect(screen.getByText("While you were away")).toBeInTheDocument();
    });
  });

  describe("period picker", () => {
    it("defaults to 24h", () => {
      renderComponent();
      const btn24 = screen.getByRole("button", { name: "Last 24h" });
      expect(btn24.getAttribute("aria-pressed")).toBe("true");
    });

    it("changes to 48h when 48h button is clicked", () => {
      renderComponent();
      const btn48 = screen.getByRole("button", { name: "Last 48h" });
      fireEvent.click(btn48);
      expect(btn48.getAttribute("aria-pressed")).toBe("true");
      expect(
        screen.getByRole("button", { name: "Last 24h" }).getAttribute("aria-pressed"),
      ).toBe("false");
    });

    it("shows all three period options", () => {
      renderComponent();
      expect(screen.getByRole("button", { name: "Last 24h" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Last 48h" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Last 72h" })).toBeInTheDocument();
    });
  });

  describe("'Got it' button", () => {
    it("calls onClose when clicked", () => {
      renderComponent({ onClose: mockOnClose });
      const gotItBtn = screen.getByRole("button", { name: "Got it" });
      fireEvent.click(gotItBtn);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("loading state", () => {
    it("shows loading indicator while data is pending", () => {
      vi.mocked(trpc.careEvents.timeline.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as ReturnType<typeof trpc.careEvents.timeline.useQuery>);
      renderComponent();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("closed state", () => {
    it("does not render dialog content when closed", () => {
      renderComponent({ open: false });
      expect(screen.queryByText("While you were away")).not.toBeInTheDocument();
    });
  });
});
