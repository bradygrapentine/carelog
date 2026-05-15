import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CoverageSettings from "../CoverageSettings";

const {
  mockListQuery,
  mockCreateMutation,
  mockDeleteMutation,
  mockInvalidate,
} = vi.hoisted(() => ({
  mockListQuery: vi.fn(),
  mockCreateMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  mockDeleteMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  mockInvalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      coverageWindows: { list: { invalidate: mockInvalidate } },
    }),
    coverageWindows: {
      list: { useQuery: mockListQuery },
      create: { useMutation: mockCreateMutation },
      delete: { useMutation: mockDeleteMutation },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockListQuery.mockReturnValue({ data: [], isLoading: false });
});

describe("CoverageSettings", () => {
  it("renders collapsed by default with Expand toggle", () => {
    render(<CoverageSettings orgId="org-1" recipientId="rec-1" />);
    expect(screen.getByText("Coverage expectations")).toBeInTheDocument();
    expect(screen.getByText("Expand")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("expands to show the list when toggle is clicked", () => {
    render(<CoverageSettings orgId="org-1" recipientId="rec-1" />);
    fireEvent.click(screen.getByText("Coverage expectations"));
    expect(screen.getByText("Collapse")).toBeInTheDocument();
  });

  it("shows empty-state text when no coverage windows exist", () => {
    render(<CoverageSettings orgId="org-1" recipientId="rec-1" />);
    fireEvent.click(screen.getByText("Coverage expectations"));
    expect(
      screen.getByText(
        "No coverage windows set yet. Add one to mark when someone is on duty.",
      ),
    ).toBeInTheDocument();
  });

  it("renders coverage windows when list returns data", () => {
    mockListQuery.mockReturnValue({
      data: [
        {
          id: "cw-1",
          label: "Morning shift",
          day_of_week: 1,
          starts_at: "07:00",
          ends_at: "12:00",
          required_role: null,
        },
      ],
      isLoading: false,
    });
    render(<CoverageSettings orgId="org-1" recipientId="rec-1" />);
    fireEvent.click(screen.getByText("Coverage expectations"));
    expect(screen.getByText("Morning shift")).toBeInTheDocument();
  });

  it("shows Loading... while list query is in-flight", () => {
    mockListQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<CoverageSettings orgId="org-1" recipientId="rec-1" />);
    fireEvent.click(screen.getByText("Coverage expectations"));
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
