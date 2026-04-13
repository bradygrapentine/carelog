import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExpensePanel } from "../ExpensePanel";

const {
  mockListUseQuery,
  mockCreateMutation,
  mockDeleteMutation,
  mockCreateMutate,
  mockDeleteMutate,
  mockInvalidate,
} = vi.hoisted(() => ({
  mockListUseQuery: vi.fn(),
  mockCreateMutation: vi.fn(),
  mockDeleteMutation: vi.fn(),
  mockCreateMutate: vi.fn(),
  mockDeleteMutate: vi.fn(),
  mockInvalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ expenses: { list: { invalidate: mockInvalidate } } }),
    expenses: {
      list: { useQuery: mockListUseQuery },
      create: { useMutation: mockCreateMutation },
      delete: { useMutation: mockDeleteMutation },
    },
  },
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

const sampleExpenses = [
  {
    id: "expense-1",
    amount: 42.5,
    currency: "USD",
    category: "medication",
    description: "Aspirin",
    paid_by_name: "Brady",
    incurred_at: "2026-04-09",
  },
];

const defaultProps = {
  orgId: ORG_ID,
  recipientId: REC_ID,
  currentUserRole: "coordinator",
};

function renderPanel(overrides: Partial<typeof defaultProps> = {}) {
  return render(<ExpensePanel {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListUseQuery.mockReturnValue({ data: [], isLoading: false });
  mockCreateMutation.mockReturnValue({
    mutate: mockCreateMutate,
    isPending: false,
  });
  mockDeleteMutation.mockReturnValue({
    mutate: mockDeleteMutate,
    isPending: false,
  });
});

describe("ExpensePanel — renders expanded by default", () => {
  it('shows "Shared expenses" header', () => {
    renderPanel();
    expect(screen.getByText(/shared expenses/i)).toBeInTheDocument();
  });
});

describe("ExpensePanel — empty state", () => {
  it('shows "No expenses logged yet" when empty', () => {
    renderPanel();
    expect(screen.getByText(/no expenses logged yet/i)).toBeInTheDocument();
  });
});

describe("ExpensePanel — with data", () => {
  beforeEach(() => {
    mockListUseQuery.mockReturnValue({
      data: sampleExpenses,
      isLoading: false,
    });
  });

  it("shows expense description", () => {
    renderPanel();
    expect(screen.getByText("Aspirin")).toBeInTheDocument();
  });

  it("shows formatted amount", () => {
    renderPanel();
    expect(screen.getByText("$42.50")).toBeInTheDocument();
  });

  it("shows delete button for coordinator", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /delete expense/i }),
    ).toBeInTheDocument();
  });

  it("hides delete button for supporter", () => {
    renderPanel({ currentUserRole: "supporter" });
    expect(
      screen.queryByRole("button", { name: /delete expense/i }),
    ).toBeNull();
  });
});

describe("ExpensePanel — role gating for form", () => {
  it("shows log form for coordinator", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /log expense/i }),
    ).toBeInTheDocument();
  });

  it("shows log form for caregiver", () => {
    renderPanel({ currentUserRole: "caregiver" });
    expect(
      screen.getByRole("button", { name: /log expense/i }),
    ).toBeInTheDocument();
  });

  it("hides log form for supporter", () => {
    renderPanel({ currentUserRole: "supporter" });
    expect(screen.queryByRole("button", { name: /log expense/i })).toBeNull();
  });
});

describe("ExpensePanel — form submission", () => {
  it("submits form with correct values", () => {
    renderPanel();

    fireEvent.change(screen.getByPlaceholderText(/amount/i), {
      target: { value: "42.50" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "medication" },
    });
    fireEvent.change(screen.getByPlaceholderText(/description/i), {
      target: { value: "Monthly prescription" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /log expense/i }).closest("form")!,
    );

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 42.5,
        category: "medication",
        description: "Monthly prescription",
        org_id: ORG_ID,
        recipient_id: REC_ID,
      }),
    );
  });
});

describe("ExpensePanel — 30-day totals", () => {
  beforeEach(() => {
    mockListUseQuery.mockReturnValue({
      data: sampleExpenses,
      isLoading: false,
    });
  });

  it("shows 30-day category totals", () => {
    renderPanel();
    expect(screen.getByText(/last 30 days by category/i)).toBeInTheDocument();
    expect(screen.getByText(/medication: \$42\.50/i)).toBeInTheDocument();
  });
});
