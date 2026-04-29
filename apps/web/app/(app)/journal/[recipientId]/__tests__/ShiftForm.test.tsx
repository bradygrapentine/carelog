// apps/web/app/journal/[recipientId]/__tests__/ShiftForm.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShiftForm } from "../ShiftForm";

// vi.hoisted ensures mockMutateAsync is available inside the vi.mock factory,
// which is hoisted above all imports by Vitest.
const {
  mockMutateAsync,
  mockUseMutation,
  mockUpdateUseMutation,
  mockInvalidate,
} = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUpdateUseMutation: vi.fn(),
  mockInvalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ shifts: { list: { invalidate: mockInvalidate } } }),
    shifts: {
      create: {
        useMutation: mockUseMutation,
      },
      update: {
        useMutation: mockUpdateUseMutation,
      },
    },
  },
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";
const COORD_ID = "aaaa0001-0000-0000-0000-000000000001";
const CAREGIVER_ID = "bbbb0002-0000-0000-0000-000000000002";
const SUPPORTER_ID = "cccc0003-0000-0000-0000-000000000003";

const members = [
  {
    id: "1",
    role: "coordinator",
    user_id: COORD_ID,
    display_name: "Alice",
    email: "alice@test.com",
  },
  {
    id: "2",
    role: "caregiver",
    user_id: CAREGIVER_ID,
    display_name: "Bob",
    email: "bob@test.com",
  },
  {
    id: "3",
    role: "supporter",
    user_id: SUPPORTER_ID,
    display_name: "Carol",
    email: "carol@test.com",
  },
];

const defaultProps = {
  members,
  recipientId: REC_ID,
  orgId: ORG_ID,
  onSuccess: vi.fn(),
};

function renderForm(overrides: Partial<typeof defaultProps> = {}) {
  return render(<ShiftForm {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseMutation.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
  mockUpdateUseMutation.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
});

// ─── collapsed state ──────────────────────────────────────────────────────────

describe("ShiftForm — collapsed", () => {
  it('renders a "+ Schedule a shift" trigger button when collapsed', () => {
    renderForm();
    expect(
      screen.getByRole("button", { name: /schedule a shift/i }),
    ).toBeInTheDocument();
  });

  it("expands the form when the trigger is clicked", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /schedule a shift/i }));
    expect(
      screen.getByRole("button", { name: /schedule shift/i }),
    ).toBeInTheDocument();
  });
});

// ─── assignee dropdown ────────────────────────────────────────────────────────

describe("ShiftForm — assignee dropdown", () => {
  beforeEach(() => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /schedule a shift/i }));
  });

  it("shows caregivers and coordinators in the assignee dropdown", () => {
    expect(screen.getByRole("option", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bob" })).toBeInTheDocument();
  });

  it("excludes supporters from the assignee dropdown", () => {
    expect(
      screen.queryByRole("option", { name: "Carol" }),
    ).not.toBeInTheDocument();
  });
});

// ─── submit button state ──────────────────────────────────────────────────────

describe("ShiftForm — submit button", () => {
  beforeEach(() => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /schedule a shift/i }));
  });

  it("is disabled when no assignee is selected", () => {
    const submit = screen.getByRole("button", { name: /schedule shift/i });
    expect(submit).toBeDisabled();
  });

  it("is enabled once assignee and start time are filled", () => {
    fireEvent.change(screen.getByLabelText(/start time/i), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /assignee/i }), {
      target: { value: CAREGIVER_ID },
    });
    expect(
      screen.getByRole("button", { name: /schedule shift/i }),
    ).not.toBeDisabled();
  });
});

// ─── custom duration ──────────────────────────────────────────────────────────

describe("ShiftForm — duration", () => {
  beforeEach(() => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /schedule a shift/i }));
  });

  it("hides end time input when a fixed duration is selected", () => {
    expect(screen.queryByLabelText(/end time/i)).not.toBeInTheDocument();
  });

  it("shows end time input when Custom duration is selected", () => {
    fireEvent.change(screen.getByRole("combobox", { name: /duration/i }), {
      target: { value: "0" },
    });
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
  });
});

// ─── form submission ──────────────────────────────────────────────────────────

describe("ShiftForm — submission", () => {
  function fillAndSubmit(durationValue = "2") {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /schedule a shift/i }));
    fireEvent.change(screen.getByLabelText(/date/i), {
      target: { value: "2026-05-01" },
    });
    fireEvent.change(screen.getByLabelText(/start time/i), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /duration/i }), {
      target: { value: durationValue },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /assignee/i }), {
      target: { value: CAREGIVER_ID },
    });
  }

  it("calls shifts.create with correctly computed start_at and end_at for fixed duration", async () => {
    mockMutateAsync.mockResolvedValue({});
    fillAndSubmit("2");
    fireEvent.click(screen.getByRole("button", { name: /schedule shift/i }));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce());
    const args = mockMutateAsync.mock.calls[0][0];
    expect(args.start_at).toBe("2026-05-01T09:00:00.000Z");
    expect(args.end_at).toBe("2026-05-01T11:00:00.000Z"); // 09:00 + 2h
    expect(args.assignee_user_id).toBe(CAREGIVER_ID);
    expect(args.org_id).toBe(ORG_ID);
    expect(args.recipient_id).toBe(REC_ID);
  });

  it("collapses the form and calls onSuccess after successful submit", async () => {
    mockMutateAsync.mockResolvedValue({});
    const onSuccess = vi.fn();
    render(<ShiftForm {...defaultProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: /schedule a shift/i }));
    fireEvent.change(screen.getByLabelText(/start time/i), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /assignee/i }), {
      target: { value: CAREGIVER_ID },
    });
    fireEvent.click(screen.getByRole("button", { name: /schedule shift/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: /schedule a shift/i }),
    ).toBeInTheDocument();
  });

  it("shows conflict error message when CONFLICT TRPCError is thrown", async () => {
    mockMutateAsync.mockRejectedValue({ data: { code: "CONFLICT" } });
    fillAndSubmit("1");
    fireEvent.click(screen.getByRole("button", { name: /schedule shift/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/already has a shift at that time/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows generic error message for non-CONFLICT errors", async () => {
    mockMutateAsync.mockRejectedValue({
      data: { code: "INTERNAL_SERVER_ERROR" },
    });
    fillAndSubmit("1");
    fireEvent.click(screen.getByRole("button", { name: /schedule shift/i }));
    await waitFor(() =>
      expect(screen.getByText(/the shift didn't save/i)).toBeInTheDocument(),
    );
  });
});
