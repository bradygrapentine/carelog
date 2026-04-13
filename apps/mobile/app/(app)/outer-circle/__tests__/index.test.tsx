import { render, fireEvent } from "@testing-library/react-native";
import OuterCircleScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: jest.fn(() => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  })),
}));

const mockRequests = [
  {
    id: "req-1",
    title: "Grocery run",
    description: "Weekly groceries",
    slots_total: 2,
    slots_filled: 1,
    active: true,
    share_token: "abc123",
    created_at: "2026-04-01T10:00:00Z",
  },
];

const mockCreate = jest.fn();
const mockDeactivate = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    outerCircle: {
      list: {
        useQuery: jest.fn(() => ({
          data: mockRequests,
          isLoading: false,
          refetch: jest.fn(),
        })),
      },
      create: {
        useMutation: jest.fn(() => ({ mutate: mockCreate, isPending: false })),
      },
      deactivate: {
        useMutation: jest.fn(() => ({
          mutate: mockDeactivate,
          isPending: false,
        })),
      },
    },
  },
}));

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }), {
  virtual: true,
});

beforeEach(() => jest.clearAllMocks());

describe("OuterCircleScreen", () => {
  it("renders request list", () => {
    const { getByText } = render(<OuterCircleScreen />);
    expect(getByText("Grocery run")).toBeTruthy();
    expect(getByText("1 / 2 slots filled")).toBeTruthy();
  });

  it("renders empty state when no requests", () => {
    const { trpc } = require("../../../../utils/trpc");
    trpc.outerCircle.list.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<OuterCircleScreen />);
    expect(getByText("No volunteer requests yet.")).toBeTruthy();
  });

  it("shows Add Request button for coordinator", () => {
    const { getByText } = render(<OuterCircleScreen />);
    expect(getByText("Add Request")).toBeTruthy();
  });

  it("hides Add Request for non-coordinator", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "caregiver",
    });
    const { queryByText } = render(<OuterCircleScreen />);
    expect(queryByText("Add Request")).toBeNull();
  });
});
