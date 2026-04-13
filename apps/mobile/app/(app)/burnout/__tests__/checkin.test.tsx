import { render, fireEvent, waitFor } from "@testing-library/react-native";
import BurnoutCheckinScreen from "../checkin";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
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

const mockMutateAsync = jest.fn().mockResolvedValue({});

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    burnout: {
      checkIn: {
        useMutation: jest.fn(() => ({
          mutateAsync: mockMutateAsync,
          isPending: false,
        })),
      },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

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
    fireEvent.press(getByLabelText("Score 3 of 5")); // step 0 → 1
    fireEvent.press(getByLabelText("Score 3 of 5")); // step 1 → 2
    fireEvent.press(getByLabelText("Score 3 of 5")); // step 2 → 3
    expect(getByLabelText("Submit check-in")).toBeTruthy();
    expect(getByText("Anything else? (optional)")).toBeTruthy();
  });

  it("Cancel at step 0 calls router.back()", () => {
    const { getByLabelText } = render(<BurnoutCheckinScreen />);
    fireEvent.press(getByLabelText("Cancel"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("Back at step 1 returns to step 0", () => {
    const { getByLabelText, getByText } = render(<BurnoutCheckinScreen />);
    fireEvent.press(getByLabelText("Score 3 of 5"));
    fireEvent.press(getByLabelText("Previous step"));
    expect(getByText("How's your sleep?")).toBeTruthy();
  });

  it("calls checkIn mutation with scores and notes on submit", async () => {
    const { getByLabelText, getByPlaceholderText } = render(
      <BurnoutCheckinScreen />,
    );
    fireEvent.press(getByLabelText("Score 4 of 5")); // sleep
    fireEvent.press(getByLabelText("Score 2 of 5")); // stress
    fireEvent.press(getByLabelText("Score 5 of 5")); // support → step 3
    fireEvent.changeText(
      getByPlaceholderText("How you're really doing…"),
      "Doing okay overall",
    );
    fireEvent.press(getByLabelText("Submit check-in"));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          org_id: "org-1",
          user_id: "user-1",
          sleep_score: 4,
          stress_score: 2,
          support_score: 5,
          notes: "Doing okay overall",
        }),
      );
    });
  });

  it("submits with undefined notes when notes blank", async () => {
    const { getByLabelText } = render(<BurnoutCheckinScreen />);
    fireEvent.press(getByLabelText("Score 3 of 5"));
    fireEvent.press(getByLabelText("Score 3 of 5"));
    fireEvent.press(getByLabelText("Score 3 of 5"));
    fireEvent.press(getByLabelText("Submit check-in"));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ notes: undefined }),
      );
    });
  });
});
