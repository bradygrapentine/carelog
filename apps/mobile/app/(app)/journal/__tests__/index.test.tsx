import { render, fireEvent, waitFor } from "@testing-library/react-native";
import JournalScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("../../../../hooks/useSyncStatus", () => ({
  useSyncStatus: jest.fn().mockReturnValue("synced"),
}));

const mockWrite = jest.fn().mockResolvedValue(undefined);
jest.mock("../../../../hooks/useOfflineWrite", () => ({
  useOfflineWrite: () => ({ write: mockWrite }),
}));

const mockTimeline = [
  {
    id: "e1",
    event_type: "journal",
    occurred_at: "2026-04-11T10:00:00Z",
    payload: { text: "Mom had a good morning", mood: "good" },
  },
  {
    id: "e2",
    event_type: "journal",
    occurred_at: "2026-04-11T08:00:00Z",
    payload: { text: "Rough night, woke up twice", mood: "difficult" },
  },
];

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    careEvents: {
      timeline: {
        useQuery: jest.fn(() => ({
          data: mockTimeline,
          isLoading: false,
          refetch: jest.fn(),
        })),
      },
      reactions: {
        useQuery: () => ({
          data: { counts: {}, myReaction: null },
          refetch: jest.fn(),
        }),
      },
      react: { useMutation: () => ({ mutate: jest.fn() }) },
      unreact: { useMutation: () => ({ mutate: jest.fn() }) },
      insert: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    medications: {
      logAdministration: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    symptoms: {
      log: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
  },
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  }),
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
});

describe("JournalScreen", () => {
  it("renders timeline entries", () => {
    const { getByText } = render(<JournalScreen />);
    expect(getByText("Mom had a good morning")).toBeTruthy();
    expect(getByText("Rough night, woke up twice")).toBeTruthy();
  });

  it("renders empty state when no entries", () => {
    const trpc = require("../../../../utils/trpc").trpc;
    trpc.careEvents.timeline.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<JournalScreen />);
    expect(getByText("No entries yet. Add the first one below.")).toBeTruthy();
  });

  it("shows mood tags in the input form", () => {
    const { getAllByText } = render(<JournalScreen />);
    expect(getAllByText("good").length).toBeGreaterThan(0);
    expect(getAllByText("okay").length).toBeGreaterThan(0);
    expect(getAllByText("difficult").length).toBeGreaterThan(0);
    expect(getAllByText("crisis").length).toBeGreaterThan(0);
  });

  it("submits a journal entry via offline write", async () => {
    const { getByPlaceholderText, getByText } = render(<JournalScreen />);
    const input = getByPlaceholderText("What's happening with care today?");
    fireEvent.changeText(input, "New entry text");
    fireEvent.press(getByText("Add entry"));

    await waitFor(() => {
      expect(mockWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: "journal",
          entry_kind: "journal_entry",
          payload: { text: "New entry text", mood: "okay" },
        }),
      );
    });
  });

  it("shows offline banner when offline", () => {
    const { useSyncStatus } = require("../../../../hooks/useSyncStatus");
    useSyncStatus.mockReturnValue("offline");
    const { getByText } = render(<JournalScreen />);
    expect(getByText(/Offline/)).toBeTruthy();
  });
});
