import { render } from "@testing-library/react-native";
import DocumentsScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: jest.fn(() => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  })),
}));

jest.mock("../../../../utils/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ access_token: "tok" }),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock("../../../../utils/wave5Utils", () => ({
  DOC_TYPES: [
    { key: "other", label: "Other" },
    { key: "insurance", label: "Insurance" },
  ],
  formatFileSize: (n: number) => n + " B",
  canUploadDocument: (role: string) => role === "coordinator",
}));

const mockDocuments = [
  {
    id: "doc-1",
    display_name: "Insurance card",
    doc_type: "insurance",
    file_size: 1024,
    created_at: "2026-04-01T00:00:00Z",
  },
];

const mockDeleteMutate = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    documents: {
      list: {
        useQuery: jest.fn(() => ({
          data: mockDocuments,
          isLoading: false,
          refetch: jest.fn(),
        })),
      },
      delete: {
        useMutation: jest.fn(() => ({
          mutate: mockDeleteMutate,
          isPending: false,
        })),
      },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DocumentsScreen", () => {
  it("renders without crash", () => {
    const { getByText } = render(<DocumentsScreen />);
    expect(getByText("Insurance card")).toBeTruthy();
  });

  it("renders empty state when no documents", () => {
    const { trpc } = require("../../../../utils/trpc");
    trpc.documents.list.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<DocumentsScreen />);
    expect(getByText("No documents yet.")).toBeTruthy();
  });

  it("shows Upload document FAB for coordinator", () => {
    const { getByLabelText } = render(<DocumentsScreen />);
    expect(getByLabelText("Upload document")).toBeTruthy();
  });

  it("hides Upload document FAB for viewer", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "viewer",
    });
    const { queryByLabelText } = render(<DocumentsScreen />);
    expect(queryByLabelText("Upload document")).toBeNull();
  });

  it("shows Scan Document button for coordinator", () => {
    const { getByLabelText } = render(<DocumentsScreen />);
    expect(getByLabelText("Scan a document")).toBeTruthy();
  });
});
