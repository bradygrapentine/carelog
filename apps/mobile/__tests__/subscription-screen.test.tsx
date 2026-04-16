import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SubscriptionScreen from "../app/(app)/subscription/index";

// Mock expo-router (not used in this screen, but avoids import errors)
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

// Mock expo-linking
const mockOpenURL = jest.fn().mockResolvedValue(undefined);
jest.mock("expo-linking", () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
  createURL: jest.fn(),
}));

// Mock auth utils so we don't need SecureStore in tests
jest.mock("../utils/auth", () => ({
  getAccessToken: jest.fn().mockResolvedValue("test-token"),
  signOut: jest.fn(),
}));

// Capture the global fetch mock so individual tests can override
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

function mockFetchWithData(data: unknown | null) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () =>
      data == null
        ? { result: { data: null } }
        : { result: { data } },
  } as unknown as Response);
}

describe("SubscriptionScreen", () => {
  it("renders plan name and Active status badge for a mocked active plan", async () => {
    mockFetchWithData({
      planName: "Family Plan",
      status: "active",
      renewalDate: "2026-05-16T00:00:00Z",
      seatCount: 5,
    });

    const { getByText } = render(<SubscriptionScreen />);

    // Wait for async data load
    await waitFor(() => {
      expect(getByText("Family Plan")).toBeTruthy();
    });

    expect(getByText("Active")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
    // Renewal date is displayed formatted — match loosely since timezone shifts month/day
    expect(getByText(/May \d+, 2026/)).toBeTruthy();
  });

  it("renders 'No active plan' when data is null", async () => {
    mockFetchWithData(null);

    const { getByText } = render(<SubscriptionScreen />);

    await waitFor(() => {
      expect(getByText("No active plan")).toBeTruthy();
    });
  });

  it("renders 'No active plan' when fetch returns 404", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as unknown as Response);

    const { getByText } = render(<SubscriptionScreen />);

    await waitFor(() => {
      expect(getByText("No active plan")).toBeTruthy();
    });
  });

  it("'Manage on web' button fires openBrowserAsync with correct URL", async () => {
    mockFetchWithData({
      planName: "Family Plan",
      status: "active",
      renewalDate: "2026-05-16T00:00:00Z",
      seatCount: 5,
    });

    const { getByLabelText } = render(<SubscriptionScreen />);

    // Wait for content to load
    await waitFor(() => {
      expect(getByLabelText("Manage subscription on web")).toBeTruthy();
    });

    fireEvent.press(getByLabelText("Manage subscription on web"));

    expect(mockOpenURL).toHaveBeenCalledWith(
      "https://yourcarelog.com/subscriptions",
    );
  });

  it("renders Past due badge for past_due status", async () => {
    mockFetchWithData({
      planName: "Family Plan",
      status: "past_due",
      renewalDate: null,
      seatCount: 3,
    });

    const { getByText } = render(<SubscriptionScreen />);

    await waitFor(() => {
      expect(getByText("Past due")).toBeTruthy();
    });
  });

  it("renders Canceled badge for canceled status", async () => {
    mockFetchWithData({
      planName: "Family Plan",
      status: "canceled",
      renewalDate: null,
      seatCount: 1,
    });

    const { getByText } = render(<SubscriptionScreen />);

    await waitFor(() => {
      expect(getByText("Canceled")).toBeTruthy();
    });
  });
});
