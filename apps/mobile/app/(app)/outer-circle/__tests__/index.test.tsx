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

  it("opens modal when Add Request pressed", () => {
    const { getByLabelText, getByText } = render(<OuterCircleScreen />);
    fireEvent.press(getByLabelText("Add volunteer request"));
    expect(getByText("New Volunteer Request")).toBeTruthy();
  });

  it("closes modal when Cancel pressed", () => {
    const { getByLabelText, getByText, queryByText } = render(
      <OuterCircleScreen />,
    );
    fireEvent.press(getByLabelText("Add volunteer request"));
    fireEvent.press(getByText("Cancel"));
    expect(queryByText("New Volunteer Request")).toBeNull();
  });

  it("submits form by pressing Submit button", () => {
    const { trpc } = require("../../../../utils/trpc");
    const mutate = jest.fn();
    trpc.outerCircle.create.useMutation.mockReturnValue({
      mutate,
      isPending: false,
    });
    const { getByLabelText, getByPlaceholderText, getByText } = render(
      <OuterCircleScreen />,
    );
    fireEvent.press(getByLabelText("Add volunteer request"));
    fireEvent.changeText(getByPlaceholderText("e.g. Grocery run"), "Meal prep");
    fireEvent.changeText(getByPlaceholderText("1"), "2");
    fireEvent.press(getByText("Submit"));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Meal prep",
        slots_total: 2,
        request_type: "volunteer",
        org_id: "org-1",
        recipient_id: "r-1",
      }),
    );
  });

  it("does not submit when title is empty", () => {
    const { trpc } = require("../../../../utils/trpc");
    const mutate = jest.fn();
    trpc.outerCircle.create.useMutation.mockReturnValue({
      mutate,
      isPending: false,
    });
    const { getByLabelText, getByPlaceholderText, getByText } = render(
      <OuterCircleScreen />,
    );
    fireEvent.press(getByLabelText("Add volunteer request"));
    fireEvent.changeText(getByPlaceholderText("1"), "2");
    fireEvent.press(getByText("Submit"));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("calls Clipboard.setStringAsync when Copy link pressed", () => {
    const Clipboard = require("expo-clipboard");
    Clipboard.setStringAsync.mockResolvedValue(undefined);
    const { getByLabelText } = render(<OuterCircleScreen />);
    fireEvent.press(getByLabelText("Copy volunteer link"));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringContaining("abc123"),
    );
  });
});
