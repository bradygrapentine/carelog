import { render, fireEvent } from "@testing-library/react-native";
import BurnoutCheckinScreen from "../checkin";

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

jest.mock("../../../../utils/auth", () => ({
  getSession: jest.fn().mockResolvedValue({
    access_token: "tok",
    user: { id: "user-1" },
  }),
}));

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    burnout: {
      checkIn: {
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

describe("BurnoutCheckinScreen", () => {
  it("renders without crash", () => {
    const { getByText } = render(<BurnoutCheckinScreen />);
    expect(getByText("Step 1 of 4")).toBeTruthy();
  });

  it("shows first question on step 0", () => {
    const { getByText } = render(<BurnoutCheckinScreen />);
    expect(getByText("How's your sleep?")).toBeTruthy();
  });

  it("advances to next step when score is selected", () => {
    const { getByLabelText, getByText } = render(<BurnoutCheckinScreen />);
    fireEvent.press(getByLabelText("Score 3 of 5"));
    expect(getByText("How's your stress?")).toBeTruthy();
  });

  it("shows Submit button at step 3 (notes step)", () => {
    const { getByLabelText, getByText } = render(<BurnoutCheckinScreen />);
    // advance through all 3 questions
    fireEvent.press(getByLabelText("Score 3 of 5")); // step 0 -> 1
    fireEvent.press(getByLabelText("Score 3 of 5")); // step 1 -> 2
    fireEvent.press(getByLabelText("Score 3 of 5")); // step 2 -> 3
    expect(getByLabelText("Submit check-in")).toBeTruthy();
    expect(getByText("Anything else? (optional)")).toBeTruthy();
  });
});
