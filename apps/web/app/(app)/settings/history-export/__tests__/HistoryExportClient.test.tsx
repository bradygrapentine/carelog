import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HistoryExportClient } from "../HistoryExportClient";

// ── trpc mock (vi.hoisted so the mock factory runs before imports) ──────────

const { mockPreviewQuery, mockMutateAsync, mockGenerateIsPending } = vi.hoisted(
  () => ({
    mockPreviewQuery: vi.fn(),
    mockMutateAsync: vi.fn(),
    mockGenerateIsPending: { value: false },
  }),
);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    historyExport: {
      preview: {
        useQuery: () => mockPreviewQuery(),
      },
      generate: {
        useMutation: () => ({
          mutateAsync: mockMutateAsync,
          isPending: mockGenerateIsPending.value,
        }),
      },
    },
  },
}));

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const REC_ID = "22222222-2222-2222-2222-222222222222";

const DEFAULT_PREVIEW = {
  care_events: 42,
  medications: 5,
  symptom_readings: 12,
  eol_plan: false,
  documents_metadata: 3,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockGenerateIsPending.value = false;
  mockPreviewQuery.mockReturnValue({
    data: DEFAULT_PREVIEW,
    isLoading: false,
    error: null,
  });
});

describe("HistoryExportClient", () => {
  it("renders preview counts", () => {
    render(<HistoryExportClient orgId={ORG_ID} recipientId={REC_ID} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows loading state while preview loads", () => {
    mockPreviewQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    render(<HistoryExportClient orgId={ORG_ID} recipientId={REC_ID} />);
    expect(screen.getByText(/loading export preview/i)).toBeInTheDocument();
  });

  it("shows error when preview fails", () => {
    mockPreviewQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: "Forbidden" },
    });
    render(<HistoryExportClient orgId={ORG_ID} recipientId={REC_ID} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Forbidden");
  });

  it("shows EOL plan row when present", () => {
    mockPreviewQuery.mockReturnValue({
      data: {
        care_events: 10,
        medications: 2,
        symptom_readings: 0,
        eol_plan: true,
        documents_metadata: 0,
      },
      isLoading: false,
      error: null,
    });
    render(<HistoryExportClient orgId={ORG_ID} recipientId={REC_ID} />);
    expect(screen.getByText(/end-of-life plan/i)).toBeInTheDocument();
  });

  it("calls generate mutation and triggers download on JSON click", async () => {
    const createObjectURL = vi
      .fn()
      .mockReturnValue("blob:http://localhost/fake");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(global.URL, "createObjectURL", {
      value: createObjectURL,
      writable: true,
    });
    Object.defineProperty(global.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      writable: true,
    });

    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const el = origCreate("a");
        el.click = clickSpy;
        return el;
      }
      return origCreate(tag);
    });

    mockMutateAsync.mockResolvedValue({
      snapshot: {
        generated_at: "2024-01-01T00:00:00Z",
        recipient_id: REC_ID,
        recipient_name: "Jane Doe",
        dob: null,
        care_events: [],
        medications: [],
        symptom_readings: [],
        eol_plan: null,
        documents_metadata: [],
      },
    });

    render(<HistoryExportClient orgId={ORG_ID} recipientId={REC_ID} />);

    const jsonBtn = screen.getByRole("button", { name: /download json/i });
    fireEvent.click(jsonBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        org_id: ORG_ID,
        recipient_id: REC_ID,
      });
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  it("shows JSON error message on mutation failure", async () => {
    mockMutateAsync.mockRejectedValue(new Error("Export failed"));

    render(<HistoryExportClient orgId={ORG_ID} recipientId={REC_ID} />);
    const jsonBtn = screen.getByRole("button", { name: /download json/i });
    fireEvent.click(jsonBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /JSON export error.*Export failed/i,
      );
    });
  });

  it("has accessible labels on buttons", () => {
    render(<HistoryExportClient orgId={ORG_ID} recipientId={REC_ID} />);
    expect(
      screen.getByRole("button", { name: /download json/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download pdf/i }),
    ).toBeInTheDocument();
  });
});
