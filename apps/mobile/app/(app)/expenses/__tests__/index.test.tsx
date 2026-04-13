import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import ExpensesScreen from "../index";

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

jest.mock("../../../../utils/wave5Utils", () => ({
  formatCurrency: (n: number) => "$" + n.toFixed(2),
  canLogExpense: (role: string) => role === "coordinator",
  canDeleteExpense: (role: string) => role === "coordinator",
}));

const mockExpenses = [
  {
    id: "e1",
    amount: 50,
    category: "medication",
    description: "Prescriptions",
    incurred_at: "2026-04-01T00:00:00Z",
  },
];

const mockDeleteMutate = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    expenses: {
      list: {
        useQuery: jest.fn(() => ({
          data: mockExpenses,
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
  jest.spyOn(Alert, "alert");
});

describe("ExpensesScreen", () => {
  it("renders without crash", () => {
    const { getByText } = render(<ExpensesScreen />);
    expect(getByText("$50.00")).toBeTruthy();
  });

  it("renders empty state when no expenses", () => {
    const { trpc } = require("../../../../utils/trpc");
    trpc.expenses.list.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<ExpensesScreen />);
    expect(getByText("No expenses logged yet.")).toBeTruthy();
  });

  it("shows Add expense button for coordinator", () => {
    const { getByLabelText } = render(<ExpensesScreen />);
    expect(getByLabelText("Add expense")).toBeTruthy();
  });

  it("renders section header for expense month", () => {
    const { getByText } = render(<ExpensesScreen />);
    expect(getByText("March 2026")).toBeTruthy();
  });

  it("long press expense shows delete confirm and calls mutation", async () => {
    const { getByLabelText } = render(<ExpensesScreen />);
    fireEvent(
      getByLabelText("$50.00 Prescriptions, long press to delete"),
      "longPress",
    );
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Delete expense?",
        "This cannot be undone.",
        expect.any(Array),
      );
    });
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    await act(async () => {
      buttons.find((b) => b.text === "Delete")?.onPress?.();
    });
    expect(mockDeleteMutate).toHaveBeenCalledWith({
      id: "e1",
      org_id: "org-1",
    });
  });

  it("hides Add expense button for viewer", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "viewer",
    });
    const { queryByLabelText } = render(<ExpensesScreen />);
    expect(queryByLabelText("Add expense")).toBeNull();
  });
});
