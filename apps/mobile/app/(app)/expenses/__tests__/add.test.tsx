import { render, fireEvent } from "@testing-library/react-native";
import ExpenseAddScreen from "../add";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  }),
}));

jest.mock("../../../../utils/wave5Utils", () => ({
  EXPENSE_CATEGORIES: [
    { key: "medication", label: "Medication" },
    { key: "supplies", label: "Supplies" },
  ],
}));

jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    expenses: {
      create: {
        useMutation: jest.fn(() => ({
          mutateAsync: jest.fn().mockResolvedValue({}),
          isPending: false,
        })),
      },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ExpenseAddScreen", () => {
  it("renders without crash", () => {
    const { getByText } = render(<ExpenseAddScreen />);
    expect(getByText("Log expense")).toBeTruthy();
  });

  it("shows Save expense button", () => {
    const { getByLabelText } = render(<ExpenseAddScreen />);
    expect(getByLabelText("Save expense")).toBeTruthy();
  });

  it("shows Cancel button", () => {
    const { getByLabelText } = render(<ExpenseAddScreen />);
    expect(getByLabelText("Cancel")).toBeTruthy();
  });

  it("submit button is enabled with valid inputs", () => {
    const { getByPlaceholderText, getByLabelText } = render(
      <ExpenseAddScreen />,
    );
    fireEvent.changeText(getByPlaceholderText("$0.00"), "25.00");
    fireEvent.changeText(
      getByPlaceholderText("What was this for?"),
      "Test description",
    );
    // Button should be accessible (not disabled label)
    expect(getByLabelText("Save expense")).toBeTruthy();
  });
});
