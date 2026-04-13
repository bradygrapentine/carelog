import { render, fireEvent } from "@testing-library/react-native";
import BurnoutSummaryScreen from "../summary";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  }),
}));

jest.mock("../../../../utils/wave5Utils", () => ({
  formatWeekStamp: (s: string) => s,
}));

const mockSummaryData = [
  {
    week_stamp: "2026-W15",
    avg_sleep: 3.5,
    avg_stress: 2.8,
    avg_support: 4.1,
    count: 4,
  },
];

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    burnout: {
      orgSummary: {
        useQuery: jest.fn(() => ({ data: mockSummaryData, isLoading: false })),
      },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BurnoutSummaryScreen", () => {
  it("renders without crash", () => {
    const { getByText } = render(<BurnoutSummaryScreen />);
    expect(getByText("Team burnout summary")).toBeTruthy();
  });

  it("renders summary row data", () => {
    const { getByText } = render(<BurnoutSummaryScreen />);
    expect(getByText("2026-W15")).toBeTruthy();
    expect(getByText("3.5")).toBeTruthy();
    expect(getByText("4 responses")).toBeTruthy();
  });

  it("renders empty state when no data", () => {
    const { trpc } = require("../../../../utils/trpc");
    trpc.burnout.orgSummary.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
    });
    const { getByText } = render(<BurnoutSummaryScreen />);
    expect(
      getByText("Not enough responses yet. Need 3+ per week."),
    ).toBeTruthy();
  });

  it("shows subtext about minimum responses", () => {
    const { getByText } = render(<BurnoutSummaryScreen />);
    expect(
      getByText("Averages shown only for weeks with 3+ responses."),
    ).toBeTruthy();
  });

  it("Back button calls router.back()", () => {
    const mockBack = jest.fn();
    jest
      .spyOn(require("expo-router"), "useRouter")
      .mockReturnValue({ back: mockBack });
    const { getByLabelText } = render(<BurnoutSummaryScreen />);
    fireEvent.press(getByLabelText("Back"));
    expect(mockBack).toHaveBeenCalled();
  });
});
