import { render, fireEvent, waitFor } from "@testing-library/react-native";
import JournalScreen from "../index";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// BottomSheet uses Animated + PanResponder which don't behave well in jest.
// Replace with a simple pass-through that renders children when visible.
jest.mock("../../../../components/journal/BottomSheet", () => ({
  BottomSheet: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => {
    const React = require("react");
    const { View } = require("react-native");
    return visible ? React.createElement(View, null, children) : null;
  },
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1" }),
}));

jest.mock("../../../../hooks/useOfflineWrite", () => ({
  useOfflineWrite: () => ({ write: mockWrite }),
}));

const mockWrite = jest.fn().mockResolvedValue(undefined);

jest.mock("../../../../hooks/useSyncStatus", () => ({
  useSyncStatus: jest.fn(() => "synced"),
}));

const mockTimeline = [
  {
    id: "ev-1",
    event_type: "journal",
    entry_kind: "journal_entry",
    occurred_at: "2026-04-01T10:00:00Z",
    payload: { text: "Feeling better today", mood: "okay" },
  },
  {
    id: "ev-2",
    event_type: "journal",
    entry_kind: "journal_entry",
    occurred_at: "2026-04-02T09:00:00Z",
    payload: { text: "Rough night", mood: "difficult" },
  },
];

const mockRefetch = jest.fn();
const mockReact = jest.fn();
const mockUnreact = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    careEvents: {
      timeline: {
        useQuery: jest.fn(() => ({
          data: mockTimeline,
          isLoading: false,
          refetch: mockRefetch,
        })),
      },
      reactions: {
        useQuery: jest.fn(() => ({
          data: { counts: { heart: 2 }, myReaction: null },
          refetch: jest.fn(),
        })),
      },
      react: {
        useMutation: jest.fn(() => ({ mutate: mockReact, isPending: false })),
      },
      unreact: {
        useMutation: jest.fn(() => ({ mutate: mockUnreact, isPending: false })),
      },
    },
  },
}));

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

jest.mock("../../../../store/offlineQueue", () => ({
  getQueue: jest.fn().mockResolvedValue([]),
  enqueue: jest.fn(),
  dequeue: jest.fn(),
  incrementAttempts: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("JournalScreen", () => {
  it("renders timeline entries", () => {
    const { getByText } = render(<JournalScreen />);
    expect(getByText("Feeling better today")).toBeTruthy();
    expect(getByText("Rough night")).toBeTruthy();
  });

  it("shows mood tags in the bottom sheet when FAB is pressed", () => {
    const { getByLabelText, getByText } = render(<JournalScreen />);
    // Press FAB to open the sheet
    fireEvent.press(getByLabelText("Add new journal entry"));
    // Now the mood buttons should be visible
    expect(getByLabelText("Good mood")).toBeTruthy();
    expect(getByLabelText("Okay mood")).toBeTruthy();
    expect(getByLabelText("Difficult mood")).toBeTruthy();
    expect(getByLabelText("Crisis mood")).toBeTruthy();
  });

  it("submits a journal entry via offline write", async () => {
    const { getByPlaceholderText, getByLabelText } = render(<JournalScreen />);
    // Open the bottom sheet with FAB
    fireEvent.press(getByLabelText("Add new journal entry"));
    // Type in the textarea
    const input = getByPlaceholderText("What's happening with care today?");
    fireEvent.changeText(input, "New entry text");
    // Press Save button
    fireEvent.press(getByLabelText("Save entry"));

    await waitFor(() => {
      expect(mockWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: "journal",
          entry_kind: "journal_entry",
          payload: expect.objectContaining({ text: "New entry text" }),
        }),
      );
    });
  });

  it("shows offline banner when offline", () => {
    const { useSyncStatus } = require("../../../../hooks/useSyncStatus");
    useSyncStatus.mockReturnValueOnce("offline");
    const { getByText } = render(<JournalScreen />);
    expect(
      getByText("● Offline — entries will sync when connected"),
    ).toBeTruthy();
  });

  it("shows syncing banner when pending", () => {
    const { useSyncStatus } = require("../../../../hooks/useSyncStatus");
    useSyncStatus.mockReturnValueOnce("pending");
    const { getByText } = render(<JournalScreen />);
    expect(getByText("↑ Syncing entries…")).toBeTruthy();
  });

  it("expands entry when tapped", () => {
    const { getAllByLabelText, getByText } = render(<JournalScreen />);
    fireEvent.press(getAllByLabelText("Expand entry")[0]);
    expect(getByText("Open entry →")).toBeTruthy();
  });

  it("collapses entry when tapped again", () => {
    const { getAllByLabelText, queryByText } = render(<JournalScreen />);
    fireEvent.press(getAllByLabelText("Expand entry")[0]);
    fireEvent.press(getAllByLabelText("Collapse entry")[0]);
    expect(queryByText("Open entry →")).toBeNull();
  });

  it("navigates to entry detail when Open entry pressed", () => {
    const { getAllByLabelText, getByText } = render(<JournalScreen />);
    fireEvent.press(getAllByLabelText("Expand entry")[0]);
    fireEvent.press(getByText("Open entry →"));
    expect(mockPush).toHaveBeenCalledWith("/journal/ev-1");
  });

  it("shows reaction count when entry expanded", () => {
    const { getAllByLabelText, getByText } = render(<JournalScreen />);
    fireEvent.press(getAllByLabelText("Expand entry")[0]);
    expect(getByText("2")).toBeTruthy();
  });
});
