import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ExpenseAddScreen from "../add";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
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
    { key: "transport", label: "Transport" },
  ],
}));

jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");

const mockMutateAsync = jest.fn().mockResolvedValue({});

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    expenses: {
      create: {
        useMutation: jest.fn(() => ({
          mutateAsync: mockMutateAsync,
          isPending: false,
        })),
      },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

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

  it("Cancel calls router.back()", () => {
    const { getByLabelText } = render(<ExpenseAddScreen />);
    fireEvent.press(getByLabelText("Cancel"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("Save expense button is disabled when amount is empty", () => {
    const { getByLabelText } = render(<ExpenseAddScreen />);
    const btn = getByLabelText("Save expense");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("Save expense button is disabled when description is empty", () => {
    const { getByPlaceholderText, getByLabelText } = render(
      <ExpenseAddScreen />,
    );
    fireEvent.changeText(getByPlaceholderText("$0.00"), "25.00");
    const btn = getByLabelText("Save expense");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("calls create mutation with correct args on submit", async () => {
    const { getByPlaceholderText, getByLabelText } = render(
      <ExpenseAddScreen />,
    );
    fireEvent.changeText(getByPlaceholderText("$0.00"), "42.50");
    fireEvent.changeText(
      getByPlaceholderText("What was this for?"),
      "Prescriptions",
    );
    fireEvent.press(getByLabelText("Save expense"));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: "org-1",
          recipient_id: "r-1",
          amount: 42.5,
          category: "medication",
          description: "Prescriptions",
        }),
      );
    });
  });

  it("submits with selected category", async () => {
    const { getByPlaceholderText, getByLabelText } = render(
      <ExpenseAddScreen />,
    );
    fireEvent.press(getByLabelText("Supplies category"));
    fireEvent.changeText(getByPlaceholderText("$0.00"), "10.00");
    fireEvent.changeText(
      getByPlaceholderText("What was this for?"),
      "Gauze pads",
    );
    fireEvent.press(getByLabelText("Save expense"));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ category: "supplies" }),
      );
    });
  });
});
