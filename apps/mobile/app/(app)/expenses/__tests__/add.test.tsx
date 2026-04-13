import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert");
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

  it("createMut onSuccess calls router.back()", () => {
    const { trpc } = require("../../../../utils/trpc");
    let capturedOpts: {
      onSuccess?: () => void;
      onError?: (err: { message: string }) => void;
    };
    trpc.expenses.create.useMutation.mockImplementation(
      (opts: typeof capturedOpts) => {
        capturedOpts = opts;
        return { mutateAsync: mockMutateAsync, isPending: false };
      },
    );
    render(<ExpenseAddScreen />);
    act(() => capturedOpts?.onSuccess?.());
    expect(mockBack).toHaveBeenCalled();
  });

  it("createMut onError shows error alert", () => {
    const { trpc } = require("../../../../utils/trpc");
    let capturedOpts: {
      onSuccess?: () => void;
      onError?: (err: { message: string }) => void;
    };
    trpc.expenses.create.useMutation.mockImplementation(
      (opts: typeof capturedOpts) => {
        capturedOpts = opts;
        return { mutateAsync: mockMutateAsync, isPending: false };
      },
    );
    render(<ExpenseAddScreen />);
    act(() => capturedOpts?.onError?.({ message: "Quota exceeded" }));
    expect(Alert.alert).toHaveBeenCalledWith("Error", "Quota exceeded");
  });

  it("pressing Select date shows DateTimePicker", () => {
    const { getByLabelText, UNSAFE_queryAllByType } = render(
      <ExpenseAddScreen />,
    );
    // DateTimePicker is not rendered before press
    expect(
      UNSAFE_queryAllByType("DateTimePicker" as unknown as React.ComponentType),
    ).toHaveLength(0);
    fireEvent.press(getByLabelText("Select date"));
    // After press showDatePicker = true, DateTimePicker renders
    expect(
      UNSAFE_queryAllByType("DateTimePicker" as unknown as React.ComponentType),
    ).toHaveLength(1);
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
