// apps/web/app/journal/[recipientId]/__tests__/OuterCirclePanel.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OuterCirclePanel } from "../OuterCirclePanel";

const {
  mockCreate,
  mockDeactivate,
  mockInvalidate,
  mockListUseQuery,
  mockCreateMutation,
  mockDeactivateMutation,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockDeactivate: vi.fn(),
  mockInvalidate: vi.fn(),
  mockListUseQuery: vi.fn(),
  mockCreateMutation: vi.fn(),
  mockDeactivateMutation: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ outerCircle: { list: { invalidate: mockInvalidate } } }),
    outerCircle: {
      list: { useQuery: mockListUseQuery },
      create: { useMutation: mockCreateMutation },
      deactivate: { useMutation: mockDeactivateMutation },
    },
  },
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

const sampleRequests = [
  {
    id: "req-1",
    title: "Meals needed",
    request_type: "meal",
    slots_total: 3,
    slots_filled: 1,
    active: true,
    share_token: "abc123",
    needed_by: null,
    description: null,
    created_at: "2026-04-09T00:00:00Z",
  },
];

const defaultProps = {
  orgId: ORG_ID,
  recipientId: REC_ID,
  currentUserRole: "coordinator",
};

function renderPanel(overrides: Partial<typeof defaultProps> = {}) {
  return render(<OuterCirclePanel {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListUseQuery.mockReturnValue({ data: [] });
  mockCreateMutation.mockReturnValue({
    mutateAsync: mockCreate,
    isPending: false,
  });
  mockDeactivateMutation.mockReturnValue({
    mutateAsync: mockDeactivate,
    isPending: false,
  });
});

describe("OuterCirclePanel — renders expanded by default", () => {
  it('shows "Volunteer requests" title', () => {
    renderPanel();
    expect(screen.getByText(/volunteer requests/i)).toBeInTheDocument();
  });

  it('shows "+ New request" button without needing to expand', () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /new request/i }),
    ).toBeInTheDocument();
  });
});

describe("OuterCirclePanel — request list", () => {
  beforeEach(() => {
    mockListUseQuery.mockReturnValue({ data: sampleRequests });
  });

  it("shows request title and slot counts when data exists", () => {
    renderPanel();
    expect(screen.getByText("Meals needed")).toBeInTheDocument();
    expect(screen.getByText(/1\/3 slots filled/i)).toBeInTheDocument();
  });

  it('calls deactivate.mutate when "Deactivate" button clicked (coordinator)', async () => {
    mockDeactivate.mockResolvedValue({});
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /deactivate/i }));
    await waitFor(() => expect(mockDeactivate).toHaveBeenCalledOnce());
    expect(mockDeactivate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "req-1", org_id: ORG_ID }),
    );
  });
});

describe("OuterCirclePanel — coordinator vs supporter", () => {
  it('shows "+ New request" button for coordinator', () => {
    renderPanel({ currentUserRole: "coordinator" });
    expect(
      screen.getByRole("button", { name: /new request/i }),
    ).toBeInTheDocument();
  });

  it("renders nothing for supporter role", () => {
    const { container } = renderPanel({ currentUserRole: "supporter" });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for caregiver role", () => {
    const { container } = renderPanel({ currentUserRole: "caregiver" });
    expect(container.firstChild).toBeNull();
  });
});

describe("OuterCirclePanel — create form", () => {
  it('shows the create form when "+ New request" is clicked', () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /new request/i }));
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create request/i }),
    ).toBeInTheDocument();
  });

  it("calls create mutation with form values on submit", async () => {
    mockCreate.mockResolvedValue({});
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /new request/i }));
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Help with meals" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create request/i }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledOnce());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Help with meals",
        org_id: ORG_ID,
        recipient_id: REC_ID,
      }),
    );
  });

  it("does not call create when title is empty", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /new request/i }));
    const form = screen
      .getByRole("button", { name: /create request/i })
      .closest("form")!;
    fireEvent.submit(form);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
