import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentVault } from "../DocumentVault";

const {
  mockListUseQuery,
  mockDeleteMutation,
  mockDeleteMutate,
  mockInvalidate,
  mockAuthenticatedFetch,
  mockShareLinkMutation,
  mockShareLinkMutate,
} = vi.hoisted(() => ({
  mockListUseQuery: vi.fn(),
  mockDeleteMutation: vi.fn(),
  mockDeleteMutate: vi.fn(),
  mockInvalidate: vi.fn(),
  mockAuthenticatedFetch: vi.fn(),
  mockShareLinkMutation: vi.fn(),
  mockShareLinkMutate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ documents: { list: { invalidate: mockInvalidate } } }),
    documents: {
      list: { useQuery: mockListUseQuery },
      delete: { useMutation: mockDeleteMutation },
      createShareLink: { useMutation: mockShareLinkMutation },
    },
    medications: {
      getDocumentIdsForMedication: {
        useQuery: vi.fn().mockReturnValue({ data: undefined }),
      },
    },
  },
}));

vi.mock("@/lib/authenticatedFetch", () => ({
  authenticatedFetch: mockAuthenticatedFetch,
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

const sampleDocs = [
  {
    id: "doc-1",
    display_name: "Power of Attorney",
    doc_type: "power_of_attorney",
    file_size: 102400,
    uploaded_by: "user-1",
    created_at: "2026-04-09T00:00:00Z",
  },
];

const defaultProps = {
  orgId: ORG_ID,
  recipientId: REC_ID,
  currentUserRole: "coordinator",
};

function renderVault(overrides: Partial<typeof defaultProps> = {}) {
  return render(<DocumentVault {...defaultProps} {...overrides} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListUseQuery.mockReturnValue({ data: [], isLoading: false });
  mockDeleteMutation.mockReturnValue({
    mutate: mockDeleteMutate,
    isPending: false,
  });
  mockShareLinkMutation.mockReturnValue({
    mutate: mockShareLinkMutate,
    isPending: false,
  });
});

describe("DocumentVault — renders expanded by default", () => {
  it('shows "Document vault" header', () => {
    renderVault();
    expect(screen.getByText(/document vault/i)).toBeInTheDocument();
  });
});

describe("DocumentVault — empty state", () => {
  it('shows "No documents uploaded" when empty', () => {
    renderVault();
    expect(screen.getByText(/no documents uploaded/i)).toBeInTheDocument();
  });
});

describe("DocumentVault — with documents", () => {
  beforeEach(() => {
    mockListUseQuery.mockReturnValue({ data: sampleDocs, isLoading: false });
  });

  it("shows document display name", () => {
    renderVault();
    expect(screen.getAllByText("Power of Attorney").length).toBeGreaterThan(0);
  });

  it("shows download button for all roles", () => {
    renderVault({ currentUserRole: "supporter" });
    expect(
      screen.getByRole("button", { name: /download power of attorney/i }),
    ).toBeInTheDocument();
  });

  it("shows delete button for coordinator", () => {
    renderVault();
    expect(
      screen.getByRole("button", { name: /delete power of attorney/i }),
    ).toBeInTheDocument();
  });

  it("hides delete button for supporter", () => {
    renderVault({ currentUserRole: "supporter" });
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});

describe("DocumentVault — share with aide (ON-68)", () => {
  beforeEach(() => {
    mockListUseQuery.mockReturnValue({ data: sampleDocs, isLoading: false });
  });

  it("renders Share button per row for coordinator", () => {
    renderVault();
    expect(
      screen.getByRole("button", {
        name: /share power of attorney with aide/i,
      }),
    ).toBeInTheDocument();
  });

  it("hides Share button for supporter", () => {
    renderVault({ currentUserRole: "supporter" });
    expect(
      screen.queryByRole("button", { name: /share .*with aide/i }),
    ).toBeNull();
  });

  it("opens share panel and calls createShareLink with chosen hours", async () => {
    const { fireEvent } = await import("@testing-library/react");
    renderVault();
    fireEvent.click(
      screen.getByRole("button", {
        name: /share power of attorney with aide/i,
      }),
    );

    const hoursInput = screen.getByLabelText(/link expires in/i);
    fireEvent.change(hoursInput, { target: { value: "48" } });

    fireEvent.click(screen.getByRole("button", { name: /generate link/i }));

    expect(mockShareLinkMutate).toHaveBeenCalledWith({
      id: "doc-1",
      org_id: ORG_ID,
      expires_in_hours: 48,
    });
  });
});

describe("DocumentVault — upload form", () => {
  it("shows upload form for coordinator", () => {
    renderVault();
    expect(
      screen.getByRole("button", { name: /^upload$/i }),
    ).toBeInTheDocument();
  });

  it("hides upload form for supporter", () => {
    renderVault({ currentUserRole: "supporter" });
    expect(screen.queryByRole("button", { name: /^upload$/i })).toBeNull();
  });
});
