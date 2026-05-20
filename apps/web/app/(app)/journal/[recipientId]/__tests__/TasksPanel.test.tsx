import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TasksPanel } from "../TasksPanel";
import { trpc } from "@/lib/trpc";

const { mockCreate, mockUpdate, mockComplete, mockCancel, mockInvalidate } =
  vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockComplete: vi.fn(),
    mockCancel: vi.fn(),
    mockInvalidate: vi.fn(),
  }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ tasks: { list: { invalidate: mockInvalidate } } }),
    tasks: {
      list: { useQuery: vi.fn() },
      create: { useMutation: vi.fn() },
      update: { useMutation: vi.fn() },
      complete: { useMutation: vi.fn() },
      cancel: { useMutation: vi.fn() },
    },
    shifts: {
      list: { useQuery: vi.fn() },
    },
  },
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

const sampleTasks = [
  {
    id: "task-1",
    title: "Refill meds",
    instructions: "At CVS",
    checklist: [{ label: "Call pharmacy", done: false }],
    status: "todo",
    shift_id: null,
    assigned_to: null,
    due_at: null,
    recipient_id: REC_ID,
  },
  {
    id: "task-2",
    title: "Schedule appointment",
    instructions: null,
    checklist: [],
    status: "done",
    shift_id: null,
    assigned_to: null,
    due_at: null,
    recipient_id: REC_ID,
  },
];

const coordinatorProps = {
  orgId: ORG_ID,
  recipientId: REC_ID,
  members: [],
  currentUserRole: "coordinator",
};

const supporterProps = { ...coordinatorProps, currentUserRole: "supporter" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(trpc.tasks.list.useQuery).mockReturnValue({
    data: sampleTasks,
    isLoading: false,
  } as any);
  vi.mocked(trpc.tasks.create.useMutation).mockReturnValue({
    mutate: mockCreate,
    isPending: false,
  } as any);
  vi.mocked(trpc.tasks.update.useMutation).mockReturnValue({
    mutate: mockUpdate,
    isPending: false,
  } as any);
  vi.mocked(trpc.tasks.complete.useMutation).mockReturnValue({
    mutate: mockComplete,
    isPending: false,
  } as any);
  vi.mocked(trpc.tasks.cancel.useMutation).mockReturnValue({
    mutate: mockCancel,
    isPending: false,
  } as any);
  vi.mocked(trpc.shifts.list.useQuery).mockReturnValue({
    data: [],
  } as any);
});

describe("TasksPanel — list", () => {
  it("renders task titles from the list query", () => {
    render(<TasksPanel {...coordinatorProps} />);
    expect(screen.getByText("Refill meds")).toBeInTheDocument();
    expect(screen.getByText("Schedule appointment")).toBeInTheDocument();
  });

  it("shows an empty state when there are no tasks", () => {
    vi.mocked(trpc.tasks.list.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    render(<TasksPanel {...coordinatorProps} />);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });
});

describe("TasksPanel — create (coordinator)", () => {
  it("opens the create form and submits, calling the create mutation", () => {
    render(<TasksPanel {...coordinatorProps} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ task/i }));
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "New task" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create task/i }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ recipient_id: REC_ID, title: "New task" }),
    );
  });

  it("does not show the create affordance for a non-coordinator", () => {
    render(<TasksPanel {...supporterProps} />);
    expect(
      screen.queryByRole("button", { name: /\+ task/i }),
    ).not.toBeInTheDocument();
  });
});

describe("TasksPanel — detail", () => {
  it("toggling a checklist item calls the update mutation with the full checklist", () => {
    render(<TasksPanel {...coordinatorProps} />);
    fireEvent.click(screen.getByRole("button", { name: /refill meds/i }));
    // Now in detail view — the checklist item is a toggle button.
    fireEvent.click(screen.getByRole("button", { name: /call pharmacy/i }));
    expect(mockUpdate).toHaveBeenCalledWith({
      id: "task-1",
      checklist: [{ label: "Call pharmacy", done: true }],
    });
  });

  it("hides Complete for a non-coordinator role in the detail view", () => {
    render(<TasksPanel {...supporterProps} />);
    fireEvent.click(screen.getByRole("button", { name: /refill meds/i }));
    expect(
      screen.queryByRole("button", { name: /^complete$/i }),
    ).not.toBeInTheDocument();
  });
});
