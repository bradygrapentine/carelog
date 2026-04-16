// apps/web/app/journal/[recipientId]/__tests__/ShiftList.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShiftList } from "../ShiftList";
import type { Shift } from "@/components/shifts/ShiftCalendar";

// ─── hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockUseQuery,
  mockUseMutation,
  mockMutate,
  mockInvalidate,
  mockUseUtils,
} = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockMutate: vi.fn(),
  mockInvalidate: vi.fn(),
  mockUseUtils: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    shifts: {
      list: { useQuery: mockUseQuery },
      cancel: { useMutation: mockUseMutation },
    },
    useUtils: mockUseUtils,
  },
}));

// Mock ShiftCalendar — records its props for assertion, calls onSelectEvent on button click
vi.mock("@/components/shifts/ShiftCalendar", () => ({
  ShiftCalendar: ({
    shifts,
    onSelectEvent,
  }: {
    shifts: Shift[];
    onSelectEvent?: (s: Shift) => void;
  }) => (
    <div data-testid="shift-calendar" data-shift-count={shifts.length}>
      {shifts.map((s) => (
        <button
          key={s.id}
          data-testid={`shift-event-${s.id}`}
          onClick={() => onSelectEvent?.(s)}
        >
          {s.assigned_display_name ?? "Unassigned"}
        </button>
      ))}
    </div>
  ),
}));

// Mock ShiftPopover — renders visible content when isOpen=true
vi.mock("@/components/shifts/ShiftPopover", () => ({
  ShiftPopover: ({
    shift,
    isOpen,
    onClose,
    isCoordinator,
    onCancel,
  }: {
    shift: Shift | null;
    isOpen: boolean;
    onClose: () => void;
    isCoordinator: boolean;
    onCancel: (id: string) => void;
  }) => {
    if (!isOpen || !shift) return null;
    return (
      <div data-testid="shift-popover">
        <span data-testid="popover-assignee">
          {shift.assigned_display_name ?? "Unassigned"}
        </span>
        <button onClick={onClose} aria-label="Close">
          Close
        </button>
        {isCoordinator && shift.status !== "cancelled" && (
          <button onClick={() => onCancel(shift.id)} aria-label="Cancel shift">
            Cancel shift
          </button>
        )}
      </div>
    );
  },
}));

// ─── fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";
const USER_A_ID = "aaaa0001-0000-0000-0000-000000000001";
const USER_B_ID = "bbbb0002-0000-0000-0000-000000000002";

const members = [
  {
    id: "1",
    role: "coordinator",
    user_id: USER_A_ID,
    display_name: "Alice",
    email: "alice@test.com",
  },
  {
    id: "2",
    role: "caregiver",
    user_id: USER_B_ID,
    display_name: "Bob",
    email: "bob@test.com",
  },
];

const defaultProps = {
  orgId: ORG_ID,
  recipientId: REC_ID,
  members,
  currentUserId: USER_A_ID,
  currentUserRole: "coordinator",
};

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "00000000-0000-0000-0000-000000000099",
    org_id: ORG_ID,
    recipient_id: REC_ID,
    assignee_user_id: USER_B_ID,
    assigned_display_name: "Bob",
    start_at: "2026-04-10T09:00:00.000Z",
    end_at: "2026-04-10T11:00:00.000Z",
    status: "scheduled",
    ...overrides,
  };
}

function renderList(overrides: Partial<typeof defaultProps> = {}) {
  return render(<ShiftList {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseMutation.mockReturnValue({ mutate: mockMutate, isPending: false });
  mockUseUtils.mockReturnValue({
    shifts: { list: { invalidate: mockInvalidate } },
  });
});

// ─── card header ──────────────────────────────────────────────────────────────

describe("ShiftList — card header", () => {
  it('renders "Shift Schedule" heading', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderList();
    expect(screen.getByText("Shift Schedule")).toBeInTheDocument();
  });
});

// ─── calendar renders ─────────────────────────────────────────────────────────

describe("ShiftList — calendar integration", () => {
  it("renders ShiftCalendar with empty shifts", () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
    renderList();
    const cal = screen.getByTestId("shift-calendar");
    expect(cal).toBeInTheDocument();
    expect(cal.getAttribute("data-shift-count")).toBe("0");
  });

  it("passes shifts to ShiftCalendar", () => {
    mockUseQuery.mockReturnValue({ data: [makeShift()], isLoading: false });
    renderList();
    const cal = screen.getByTestId("shift-calendar");
    expect(cal.getAttribute("data-shift-count")).toBe("1");
  });
});

// ─── popover open/close ───────────────────────────────────────────────────────

describe("ShiftList — popover", () => {
  it("popover is hidden by default", () => {
    mockUseQuery.mockReturnValue({ data: [makeShift()], isLoading: false });
    renderList();
    expect(screen.queryByTestId("shift-popover")).not.toBeInTheDocument();
  });

  it("opens popover when a shift event is clicked", () => {
    const shift = makeShift();
    mockUseQuery.mockReturnValue({ data: [shift], isLoading: false });
    renderList();
    fireEvent.click(screen.getByTestId(`shift-event-${shift.id}`));
    expect(screen.getByTestId("shift-popover")).toBeInTheDocument();
    expect(screen.getByTestId("popover-assignee")).toHaveTextContent("Bob");
  });

  it("closes popover when Close is clicked", () => {
    const shift = makeShift();
    mockUseQuery.mockReturnValue({ data: [shift], isLoading: false });
    renderList();
    fireEvent.click(screen.getByTestId(`shift-event-${shift.id}`));
    expect(screen.getByTestId("shift-popover")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByTestId("shift-popover")).not.toBeInTheDocument();
  });
});

// ─── cancel via popover ───────────────────────────────────────────────────────

describe("ShiftList — cancel action", () => {
  it("calls shifts.cancel.mutate with correct args from popover", () => {
    const shiftId = "11111111-1111-1111-1111-111111111111";
    const shift = makeShift({ id: shiftId });
    mockUseQuery.mockReturnValue({ data: [shift], isLoading: false });
    renderList({ currentUserRole: "coordinator" });
    fireEvent.click(screen.getByTestId(`shift-event-${shiftId}`));
    fireEvent.click(screen.getByRole("button", { name: /cancel shift/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      { id: shiftId, org_id: ORG_ID },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("hides cancel button in popover for caregiver role", () => {
    const shift = makeShift();
    mockUseQuery.mockReturnValue({ data: [shift], isLoading: false });
    renderList({ currentUserRole: "caregiver" });
    fireEvent.click(screen.getByTestId(`shift-event-${shift.id}`));
    expect(
      screen.queryByRole("button", { name: /cancel shift/i }),
    ).not.toBeInTheDocument();
  });

  it("closes popover after cancel is triggered", () => {
    const shift = makeShift({ id: "22222222-2222-2222-2222-222222222222" });
    mockUseQuery.mockReturnValue({ data: [shift], isLoading: false });
    renderList({ currentUserRole: "coordinator" });
    fireEvent.click(screen.getByTestId(`shift-event-${shift.id}`));
    fireEvent.click(screen.getByRole("button", { name: /cancel shift/i }));
    expect(screen.queryByTestId("shift-popover")).not.toBeInTheDocument();
  });
});
