import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BenefitsNavigator } from "../BenefitsNavigator";

const {
  mockLatestUseQuery,
  mockScreenMutation,
  mockScreenMutate,
  mockInvalidate,
} = vi.hoisted(() => ({
  mockLatestUseQuery: vi.fn(),
  mockScreenMutation: vi.fn(),
  mockScreenMutate: vi.fn(),
  mockInvalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ benefits: { latest: { invalidate: mockInvalidate } } }),
    benefits: {
      latest: { useQuery: mockLatestUseQuery },
      screen: { useMutation: mockScreenMutation },
    },
  },
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

const defaultProps = {
  orgId: ORG_ID,
  recipientId: REC_ID,
  currentUserRole: "coordinator",
};

function renderPanel(overrides: Partial<typeof defaultProps> = {}) {
  return render(<BenefitsNavigator {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLatestUseQuery.mockReturnValue({ data: null });
  mockScreenMutation.mockReturnValue({
    mutate: mockScreenMutate,
    isPending: false,
  });
});

describe("BenefitsNavigator — role gating", () => {
  it("returns null for caregiver", () => {
    const { container } = renderPanel({ currentUserRole: "caregiver" });
    expect(container.firstChild).toBeNull();
  });

  it("returns null for supporter", () => {
    const { container } = renderPanel({ currentUserRole: "supporter" });
    expect(container.firstChild).toBeNull();
  });
});

describe("BenefitsNavigator — renders expanded by default", () => {
  it('shows "Benefits navigator" header', () => {
    renderPanel();
    expect(screen.getByText(/benefits navigator/i)).toBeInTheDocument();
  });
});

describe("BenefitsNavigator — no prior screening", () => {
  it("shows Start screener button when no prior results", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /start screener/i }),
    ).toBeInTheDocument();
  });

  it("shows questions after clicking Start screener", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /start screener/i }));
    expect(screen.getByText(/65 or older/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /find matching programs/i }),
    ).toBeInTheDocument();
  });
});

describe("BenefitsNavigator — screener submission", () => {
  it("calls screen.mutate when Find matching programs is clicked", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /start screener/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /find matching programs/i }),
    );
    expect(mockScreenMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: ORG_ID,
        recipient_id: REC_ID,
      }),
    );
  });
});

describe("BenefitsNavigator — prior results available", () => {
  beforeEach(() => {
    mockLatestUseQuery.mockReturnValue({
      data: {
        answers: {
          age65plus: true,
          veteran: false,
          lowIncome: false,
          medicareEnrolled: false,
          medicaidEnrolled: false,
        },
        results: [
          {
            key: "ship_counseling",
            name: "State Health Insurance Assistance Program (SHIP)",
            description: "Free counseling",
            applyUrl: "https://www.shiphelp.org",
          },
        ],
      },
    });
  });

  it("shows matching program from last screening", () => {
    renderPanel();
    expect(
      screen.getByText(/State Health Insurance Assistance Program/i),
    ).toBeInTheDocument();
  });

  it("shows run screener again option", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /run screener again/i }),
    ).toBeInTheDocument();
  });
});
