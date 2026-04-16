import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MedicationRecentEvents } from "../MedicationRecentEvents";

const { mockGetUseQuery } = vi.hoisted(() => ({
  mockGetUseQuery: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    medications: {
      get: { useQuery: mockGetUseQuery },
    },
  },
}));

beforeEach(() => {
  mockGetUseQuery.mockReturnValue({
    data: { recentEvents: [], linkedDocuments: [] },
    isLoading: false,
  });
});

describe("MedicationRecentEvents", () => {
  it("shows 'No recent entries' when empty", () => {
    render(<MedicationRecentEvents medicationId="med-1" />);
    expect(screen.getByText("No recent entries")).toBeInTheDocument();
  });

  it("shows event payload text", () => {
    mockGetUseQuery.mockReturnValue({
      data: {
        recentEvents: [
          {
            id: "evt-1",
            payload: { text: "Gave Lisinopril with breakfast" },
            occurred_at: "2026-04-01T08:00:00Z",
          },
        ],
        linkedDocuments: [],
      },
      isLoading: false,
    });
    render(<MedicationRecentEvents medicationId="med-1" />);
    expect(
      screen.getByText("Gave Lisinopril with breakfast"),
    ).toBeInTheDocument();
  });
});
