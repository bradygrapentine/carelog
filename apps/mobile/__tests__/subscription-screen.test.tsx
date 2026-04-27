import { render, fireEvent } from "@testing-library/react-native";
import SubscriptionScreen from "../app/(app)/subscription/index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockOpenBrowserAsync = jest.fn().mockResolvedValue({ type: "dismiss" });
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
}));

const mockUseQuery = jest.fn();

jest.mock("../utils/trpc", () => ({
  trpc: {
    billing: {
      getSubscription: {
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
      },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function mockSubscription(data: unknown | null) {
  mockUseQuery.mockReturnValue({
    data,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
}

describe("SubscriptionScreen", () => {
  it("renders plan name and Active status badge for a mocked active plan", () => {
    mockSubscription({
      planName: "Family Plan",
      status: "active",
      renewalDate: "2026-05-16T00:00:00Z",
      seatCount: 5,
    });

    const { getByText } = render(<SubscriptionScreen />);

    expect(getByText("Family Plan")).toBeTruthy();
    expect(getByText("Active")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
    // Renewal date is displayed formatted — match loosely since timezone shifts month/day
    expect(getByText(/May \d+, 2026/)).toBeTruthy();
  });

  it("renders 'No active plan' when subscription data is null (free plan)", () => {
    mockSubscription(null);

    const { getByText } = render(<SubscriptionScreen />);
    expect(getByText("No active plan")).toBeTruthy();
  });

  it("shows loading spinner while the query is in flight", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ActivityIndicator } = require("react-native");
    const { UNSAFE_getByType } = render(<SubscriptionScreen />);
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it("shows error state with Retry when the query errors", () => {
    const refetch = jest.fn();
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("network down"),
      refetch,
    });

    const { getByText, getByLabelText } = render(<SubscriptionScreen />);
    expect(getByText("Unable to load subscription")).toBeTruthy();
    fireEvent.press(getByLabelText("Retry loading subscription"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("'Manage on web' button fires openBrowserAsync with correct URL", () => {
    mockSubscription({
      planName: "Family Plan",
      status: "active",
      renewalDate: "2026-05-16T00:00:00Z",
      seatCount: 5,
    });

    const { getByLabelText } = render(<SubscriptionScreen />);
    fireEvent.press(getByLabelText("Manage subscription on web"));

    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(
      "https://yourcarelog.com/subscriptions",
    );
  });

  it("renders Past due badge for past_due status", () => {
    mockSubscription({
      planName: "Family Plan",
      status: "past_due",
      renewalDate: null,
      seatCount: 3,
    });

    const { getByText } = render(<SubscriptionScreen />);
    expect(getByText("Past due")).toBeTruthy();
  });

  it("renders Canceled badge for canceled status", () => {
    mockSubscription({
      planName: "Family Plan",
      status: "canceled",
      renewalDate: null,
      seatCount: 1,
    });

    const { getByText } = render(<SubscriptionScreen />);
    expect(getByText("Canceled")).toBeTruthy();
  });
});
