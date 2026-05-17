/**
 * UX-065 — BriefingHandoffPanel connected wrapper tests.
 *
 * Tests: happy path render, loading state, error state + retry,
 * accessibility (aria-label on list, touch-target on retry button).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BriefingHandoffPanel } from "../BriefingHandoff";

// ─── tRPC mock ────────────────────────────────────────────────────────────────
// vi.mock is hoisted before imports — use vi.hoisted for referenced vars.

type TimelineQueryResult = {
  data: unknown[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const { mockRefetch, mockTimelineQuery } = vi.hoisted(() => ({
  mockRefetch: vi.fn(),
  mockTimelineQuery: vi.fn(
    (): TimelineQueryResult => ({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  ),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    careEvents: {
      timeline: { useQuery: mockTimelineQuery },
    },
    useUtils: vi.fn(() => ({})),
  },
}));

// ─── handoffNarrative mock — deterministic stubs ──────────────────────────────

vi.mock("@/lib/handoffNarrative", () => ({
  summarizeSleep: vi.fn(() => "No sleep activity recorded"),
  summarizeMeds: vi.fn(() => "No medications recorded"),
  summarizeSchedule: vi.fn(() => "No schedule activity recorded"),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("<BriefingHandoffPanel />", () => {
  it("renders happy path with 3 narrative lines", () => {
    mockTimelineQuery.mockReturnValueOnce({
      data: [
        {
          id: "e1",
          event_type: "medication",
          entry_kind: "human",
          occurred_at: "2026-05-17T10:00:00Z",
          flagged: false,
          actor_id: "actor-1",
        },
      ],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<BriefingHandoffPanel recipientId="rec-001" />);

    expect(
      screen.getByTestId("briefing-panel-section-sleep"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("briefing-panel-section-meds"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("briefing-panel-section-schedule"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("briefing-panel-line-sleep")).toHaveTextContent(
      "No sleep activity recorded",
    );
    expect(screen.getByTestId("briefing-panel-line-meds")).toHaveTextContent(
      "No medications recorded",
    );
    expect(
      screen.getByTestId("briefing-panel-line-schedule"),
    ).toHaveTextContent("No schedule activity recorded");
  });

  it("renders loading state: aria-busy=true, no section cards", () => {
    mockTimelineQuery.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    });

    render(<BriefingHandoffPanel recipientId="rec-001" />);

    const region = screen.getByLabelText(/loading briefing/i);
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByTestId("briefing-panel-section-sleep"),
    ).not.toBeInTheDocument();
  });

  it("renders error state: alert role + retry button visible", () => {
    mockTimelineQuery.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    render(<BriefingHandoffPanel recipientId="rec-001" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("briefing-error")).toHaveTextContent(
      /could not load briefing data/i,
    );
    expect(screen.getByTestId("briefing-retry")).toBeInTheDocument();
  });

  it("retry button calls refetch on click", () => {
    mockTimelineQuery.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    render(<BriefingHandoffPanel recipientId="rec-001" />);
    fireEvent.click(screen.getByTestId("briefing-retry"));
    expect(mockRefetch).toHaveBeenCalledOnce();
  });

  it("retry button has min-h-[40px] and min-w-[40px] classes for touch target", () => {
    mockTimelineQuery.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    render(<BriefingHandoffPanel recipientId="rec-001" />);
    const btn = screen.getByTestId("briefing-retry");
    expect(btn.className).toContain("min-h-[40px]");
    expect(btn.className).toContain("min-w-[40px]");
  });

  it("list has accessible aria-label for screen readers", () => {
    mockTimelineQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<BriefingHandoffPanel recipientId="rec-001" />);
    expect(
      screen.getByRole("list", { name: /prior shift briefing/i }),
    ).toBeInTheDocument();
  });
});
