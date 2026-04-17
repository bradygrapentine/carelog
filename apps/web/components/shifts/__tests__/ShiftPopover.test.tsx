import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShiftPopover } from "../ShiftPopover";
import { trpc } from "@/lib/trpc";
import type { Shift } from "../ShiftCalendar";

// ─── tRPC mock ────────────────────────────────────────────────────────────────

const { mockUpdateMutate, mockInsertMutate, mockInvalidate } = vi.hoisted(
  () => ({
    mockUpdateMutate: vi.fn(),
    mockInsertMutate: vi.fn(),
    mockInvalidate: vi.fn(),
  }),
);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    shifts: {
      update: { useMutation: vi.fn() },
      list: { invalidate: mockInvalidate },
    },
    careEvents: {
      insert: { useMutation: vi.fn() },
      timeline: { invalidate: mockInvalidate },
    },
    useUtils: vi.fn(() => ({
      shifts: { list: { invalidate: mockInvalidate } },
      careEvents: { timeline: { invalidate: mockInvalidate } },
    })),
  },
}));

// ─── test data ────────────────────────────────────────────────────────────────

const BASE_SHIFT: Shift = {
  id: "shift-001",
  org_id: "org-001",
  recipient_id: "rec-001",
  assignee_user_id: "user-001",
  assigned_display_name: "Alice",
  start_at: "2026-04-20T08:00:00Z",
  end_at: "2026-04-20T16:00:00Z",
  status: "scheduled",
};

const DEFAULT_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  isCoordinator: true,
  orgId: "org-001",
  recipientId: "rec-001",
  onEdit: vi.fn(),
  onCancel: vi.fn(),
  onCompleted: vi.fn(),
};

function renderPopover(
  shiftOverrides?: Partial<Shift>,
  propOverrides?: Record<string, unknown>,
) {
  const shift = shiftOverrides
    ? { ...BASE_SHIFT, ...shiftOverrides }
    : BASE_SHIFT;
  return render(
    <ShiftPopover shift={shift} {...DEFAULT_PROPS} {...propOverrides} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(trpc.shifts.update.useMutation).mockReturnValue({
    mutate: mockUpdateMutate,
    isPending: false,
  } as never);
  vi.mocked(trpc.careEvents.insert.useMutation).mockReturnValue({
    mutate: mockInsertMutate,
    isPending: false,
  } as never);
});

// ─── Complete shift button visibility ─────────────────────────────────────────

describe("ShiftPopover — Complete shift button", () => {
  it("shows Complete shift button for scheduled shifts", () => {
    renderPopover({ status: "scheduled" });
    expect(
      screen.getByRole("button", { name: /complete shift/i }),
    ).toBeInTheDocument();
  });

  it("shows Complete shift button for in_progress shifts", () => {
    renderPopover({ status: "in_progress" });
    expect(
      screen.getByRole("button", { name: /complete shift/i }),
    ).toBeInTheDocument();
  });

  it("hides Complete shift button for already-completed shifts", () => {
    renderPopover({ status: "completed" });
    expect(
      screen.queryByRole("button", { name: /complete shift/i }),
    ).not.toBeInTheDocument();
  });

  it("hides Complete shift button for cancelled shifts", () => {
    renderPopover({ status: "cancelled" });
    expect(
      screen.queryByRole("button", { name: /complete shift/i }),
    ).not.toBeInTheDocument();
  });

  it("hides Complete shift button when user is not coordinator", () => {
    renderPopover({ status: "scheduled" }, { isCoordinator: false });
    expect(
      screen.queryByRole("button", { name: /complete shift/i }),
    ).not.toBeInTheDocument();
  });
});

// ─── handoff note flow ────────────────────────────────────────────────────────

describe("ShiftPopover — handoff note flow", () => {
  it("handoff textarea is hidden before completing a shift", () => {
    renderPopover({ status: "scheduled" });
    expect(
      screen.queryByPlaceholderText(/anything the next caregiver/i),
    ).not.toBeInTheDocument();
  });

  it("shows handoff textarea after clicking Complete shift (onSuccess fires)", () => {
    // Capture onSuccess from useMutation config and call it synchronously
    vi.mocked(trpc.shifts.update.useMutation).mockImplementation(
      (config) =>
        ({
          mutate: vi.fn(() => {
            (config as { onSuccess?: () => void })?.onSuccess?.();
          }),
          isPending: false,
        }) as never,
    );

    renderPopover({ status: "scheduled" });
    fireEvent.click(screen.getByRole("button", { name: /complete shift/i }));

    expect(
      screen.getByPlaceholderText(/anything the next caregiver/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit note/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
  });

  it("Submit note calls careEvents.insert with correct handoff payload", () => {
    vi.mocked(trpc.shifts.update.useMutation).mockImplementation(
      (config) =>
        ({
          mutate: vi.fn(() => {
            (config as { onSuccess?: () => void })?.onSuccess?.();
          }),
          isPending: false,
        }) as never,
    );

    renderPopover({ status: "scheduled" });
    fireEvent.click(screen.getByRole("button", { name: /complete shift/i }));

    const textarea = screen.getByPlaceholderText(
      /anything the next caregiver/i,
    );
    fireEvent.change(textarea, { target: { value: "Patient had a good day" } });
    fireEvent.click(screen.getByRole("button", { name: /submit note/i }));

    expect(mockInsertMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-001",
        recipientId: "rec-001",
        eventType: "handoff",
        entryKind: "human",
        payload: { text: "Patient had a good day" },
      }),
      expect.any(Object),
    );
  });

  it("Skip closes without creating a care_event", () => {
    vi.mocked(trpc.shifts.update.useMutation).mockImplementation(
      (config) =>
        ({
          mutate: vi.fn(() => {
            (config as { onSuccess?: () => void })?.onSuccess?.();
          }),
          isPending: false,
        }) as never,
    );

    const onClose = vi.fn();
    renderPopover({ status: "scheduled" }, { onClose });

    fireEvent.click(screen.getByRole("button", { name: /complete shift/i }));
    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    expect(mockInsertMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
