// apps/web/app/journal/[recipientId]/__tests__/SymptomPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SymptomPanel } from "../SymptomPanel";

const { mockLogMutate, mockInvalidate, mockListUseQuery, mockLogMutation } =
  vi.hoisted(() => ({
    mockLogMutate: vi.fn(),
    mockInvalidate: vi.fn(),
    mockListUseQuery: vi.fn(),
    mockLogMutation: vi.fn(),
  }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ symptoms: { list: { invalidate: mockInvalidate } } }),
    symptoms: {
      list: { useQuery: mockListUseQuery },
      log: { useMutation: mockLogMutation },
    },
  },
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

const sampleReadings = [
  {
    id: "reading-1",
    pain_level: 7,
    mood: "difficult",
    appetite: null,
    mobility: null,
    notes: null,
    recorded_at: "2026-04-09T00:00:00Z",
  },
];

const defaultProps = {
  orgId: ORG_ID,
  recipientId: REC_ID,
  currentUserRole: "coordinator",
};

function renderPanel(overrides: Partial<typeof defaultProps> = {}) {
  return render(<SymptomPanel {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListUseQuery.mockReturnValue({ data: [], isLoading: false });
  mockLogMutation.mockReturnValue({ mutate: mockLogMutate, isPending: false });
});

describe("SymptomPanel — renders expanded by default", () => {
  it('shows "Symptom readings" title', () => {
    renderPanel();
    expect(screen.getByText(/symptom readings/i)).toBeInTheDocument();
  });
});

describe("SymptomPanel — empty state", () => {
  it("shows empty state for empty data", () => {
    renderPanel();
    expect(
      screen.getByText(/no readings yet\. log one to start a trend line/i),
    ).toBeInTheDocument();
  });
});

describe("SymptomPanel — readings list", () => {
  beforeEach(() => {
    mockListUseQuery.mockReturnValue({
      data: sampleReadings,
      isLoading: false,
    });
  });

  it("shows pain level and mood when data exists", () => {
    renderPanel();
    expect(screen.getByText("7/10")).toBeInTheDocument();
    // The mood tag appears in the readings list; the form also renders mood buttons on desktop,
    // so use getAllByText and confirm at least one match exists.
    expect(screen.getAllByText(/difficult/i).length).toBeGreaterThanOrEqual(1);
  });
});

describe("SymptomPanel — coordinator vs supporter", () => {
  it('shows "+ Log reading" button for coordinator', () => {
    renderPanel({ currentUserRole: "coordinator" });
    expect(
      screen.getByRole("button", { name: /\+ log reading/i }),
    ).toBeInTheDocument();
  });

  it('does not show "+ Log reading" button for supporter', () => {
    renderPanel({ currentUserRole: "supporter" });
    expect(
      screen.queryByRole("button", { name: /\+ log reading/i }),
    ).not.toBeInTheDocument();
  });
});

describe("SymptomPanel — log form", () => {
  it('shows log form with pain range input and mood pill buttons when "+ Log reading" clicked', () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /\+ log reading/i }));
    expect(screen.getByLabelText(/pain level/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^good$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^okay$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save reading/i }),
    ).toBeInTheDocument();
  });

  it("calls symptoms.log.mutate on form submit with correct values", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /\+ log reading/i }));

    const painInput = screen.getByLabelText(/pain level/i);
    fireEvent.change(painInput, { target: { value: "8" } });

    fireEvent.click(screen.getByRole("button", { name: /^okay$/i }));

    fireEvent.click(screen.getByRole("button", { name: /save reading/i }));

    await waitFor(() => expect(mockLogMutate).toHaveBeenCalledOnce());
    expect(mockLogMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: ORG_ID,
        recipient_id: REC_ID,
        pain_level: 8,
        mood: "okay",
      }),
    );
  });
});
