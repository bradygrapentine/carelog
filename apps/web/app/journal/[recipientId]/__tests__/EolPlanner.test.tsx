import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EolPlanner } from "../EolPlanner";

const {
  mockGetUseQuery,
  mockDocsUseQuery,
  mockUpsertMutation,
  mockUpsertMutate,
  mockInvalidate,
} = vi.hoisted(() => ({
  mockGetUseQuery: vi.fn(),
  mockDocsUseQuery: vi.fn(),
  mockUpsertMutation: vi.fn(),
  mockUpsertMutate: vi.fn(),
  mockInvalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      eolPlan: { get: { invalidate: mockInvalidate } },
    }),
    eolPlan: {
      get: { useQuery: mockGetUseQuery },
      upsert: { useMutation: mockUpsertMutation },
    },
    documents: {
      list: { useQuery: mockDocsUseQuery },
    },
  },
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

const samplePlan = {
  healthcare_proxy: "Jane Smith - 555-0199",
  resuscitation_pref: "dnr",
  funeral_pref: "Cremation",
  legacy_message: "I love you all.",
  attorney_name: "Bob Jones",
  attorney_contact: "bob@law.com",
};

const defaultProps = {
  orgId: ORG_ID,
  recipientId: REC_ID,
  currentUserRole: "coordinator",
};

function renderPlanner(overrides: Partial<typeof defaultProps> = {}) {
  return render(<EolPlanner {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUseQuery.mockReturnValue({ data: null, isLoading: false });
  mockDocsUseQuery.mockReturnValue({ data: [] });
  mockUpsertMutation.mockReturnValue({
    mutate: mockUpsertMutate,
    isPending: false,
  });
});

describe("EolPlanner — role gating", () => {
  it("returns null for caregiver", () => {
    const { container } = renderPlanner({ currentUserRole: "caregiver" });
    expect(container.firstChild).toBeNull();
  });

  it("returns null for supporter", () => {
    const { container } = renderPlanner({ currentUserRole: "supporter" });
    expect(container.firstChild).toBeNull();
  });
});

describe("EolPlanner — collapsed state", () => {
  it('shows "End-of-life plan" button', () => {
    renderPlanner();
    expect(
      screen.getByRole("button", { name: /end-of-life plan/i }),
    ).toBeInTheDocument();
  });

  it("shows coordinator-only badge", () => {
    renderPlanner();
    expect(screen.getByText(/coordinator only/i)).toBeInTheDocument();
  });
});

describe("EolPlanner — expanded, no plan", () => {
  it('shows "Create plan" button when no plan exists', () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /end-of-life plan/i }));
    expect(
      screen.getByRole("button", { name: /create plan/i }),
    ).toBeInTheDocument();
  });

  it("shows edit form after clicking Create plan", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /end-of-life plan/i }));
    fireEvent.click(screen.getByRole("button", { name: /create plan/i }));
    expect(
      screen.getByRole("button", { name: /save plan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/resuscitation preference/i),
    ).toBeInTheDocument();
  });
});

describe("EolPlanner — expanded, plan exists", () => {
  beforeEach(() => {
    mockGetUseQuery.mockReturnValue({ data: samplePlan, isLoading: false });
  });

  it("shows healthcare proxy value", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /end-of-life plan/i }));
    expect(screen.getByText("Jane Smith - 555-0199")).toBeInTheDocument();
  });

  it("shows resuscitation preference label", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /end-of-life plan/i }));
    expect(screen.getByText(/do not resuscitate/i)).toBeInTheDocument();
  });

  it('shows "Edit plan" button', () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /end-of-life plan/i }));
    expect(
      screen.getByRole("button", { name: /edit plan/i }),
    ).toBeInTheDocument();
  });
});

describe("EolPlanner — advance directive documents", () => {
  beforeEach(() => {
    mockGetUseQuery.mockReturnValue({ data: samplePlan, isLoading: false });
    mockDocsUseQuery.mockReturnValue({
      data: [
        {
          id: "doc-1",
          display_name: "Living Will",
          doc_type: "advance_directive",
        },
        {
          id: "doc-2",
          display_name: "Insurance Card",
          doc_type: "insurance_card",
        },
      ],
    });
  });

  it("shows only advance_directive documents", () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /end-of-life plan/i }));
    expect(screen.getByText("Living Will →")).toBeInTheDocument();
    expect(screen.queryByText("Insurance Card →")).toBeNull();
  });
});
