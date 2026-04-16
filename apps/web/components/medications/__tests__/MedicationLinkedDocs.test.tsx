import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MedicationLinkedDocs } from "../MedicationLinkedDocs";

const { mockGetUseQuery } = vi.hoisted(() => ({
  mockGetUseQuery: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    medications: {
      get: { useQuery: mockGetUseQuery },
    },
  },
}));

beforeEach(() => {
  mockGetUseQuery.mockReturnValue({
    data: { linkedDocuments: [], recentEvents: [] },
    isLoading: false,
  });
});

describe("MedicationLinkedDocs", () => {
  it("shows 'No documents linked' when empty", () => {
    render(<MedicationLinkedDocs medicationId="med-1" />);
    expect(screen.getByText("No documents linked")).toBeInTheDocument();
  });

  it("shows document display names", () => {
    mockGetUseQuery.mockReturnValue({
      data: {
        linkedDocuments: [
          {
            id: "doc-1",
            display_name: "Insurance Card",
            doc_type: "insurance_card",
            created_at: "",
          },
        ],
        recentEvents: [],
      },
      isLoading: false,
    });
    render(<MedicationLinkedDocs medicationId="med-1" />);
    expect(screen.getByText("Insurance Card")).toBeInTheDocument();
  });
});
