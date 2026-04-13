import { render } from "@testing-library/react-native";
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
