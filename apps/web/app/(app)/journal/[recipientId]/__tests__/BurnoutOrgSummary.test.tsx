import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BurnoutOrgSummary } from "../BurnoutOrgSummary";

const { mockOrgSummary } = vi.hoisted(() => ({
  mockOrgSummary: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    burnout: {
      orgSummary: { useQuery: mockOrgSummary },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BurnoutOrgSummary", () => {
  it("renders null when user is not a coordinator", () => {
    mockOrgSummary.mockReturnValue({ data: [], isLoading: false });
    const { container } = render(
      <BurnoutOrgSummary orgId="org-1" currentUserRole="caregiver" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows Team wellbeing title for coordinators", () => {
    mockOrgSummary.mockReturnValue({ data: [], isLoading: false });
    render(<BurnoutOrgSummary orgId="org-1" currentUserRole="coordinator" />);
    expect(screen.getByText("Team wellbeing")).toBeInTheDocument();
  });

  it("shows suppression copy when data is empty", () => {
    mockOrgSummary.mockReturnValue({ data: [], isLoading: false });
    render(<BurnoutOrgSummary orgId="org-1" currentUserRole="coordinator" />);
    expect(
      screen.getByText(/Individual scores are never shown/),
    ).toBeInTheDocument();
  });

  it("renders week rows when data is non-empty", () => {
    mockOrgSummary.mockReturnValue({
      data: [
        {
          week_stamp: "2026-W14",
          avg_sleep: 3.5,
          avg_stress: 2.5,
          avg_support: 4.0,
          count: 3,
        },
      ],
      isLoading: false,
    });
    render(<BurnoutOrgSummary orgId="org-1" currentUserRole="coordinator" />);
    expect(screen.getByText("2026-W14")).toBeInTheDocument();
    expect(screen.getByText(/sleep 3\.5/)).toBeInTheDocument();
  });

  it("shows Loading... state", () => {
    mockOrgSummary.mockReturnValue({ data: undefined, isLoading: true });
    render(<BurnoutOrgSummary orgId="org-1" currentUserRole="coordinator" />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
