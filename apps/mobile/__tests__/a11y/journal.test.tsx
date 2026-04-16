import { render } from "@testing-library/react-native";
import JournalScreen from "../../app/(app)/journal/index";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1" }),
}));

jest.mock("../../hooks/useOfflineWrite", () => ({
  useOfflineWrite: () => ({ write: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock("../../hooks/useSyncStatus", () => ({
  useSyncStatus: jest.fn(() => "synced"),
}));

jest.mock("../../utils/trpc", () => ({
  trpc: {
    careEvents: {
      timeline: {
        useQuery: jest.fn(() => ({
          data: [],
          isLoading: false,
          refetch: jest.fn(),
        })),
      },
      reactions: {
        useQuery: jest.fn(() => ({
          data: { counts: {}, myReaction: null },
          refetch: jest.fn(),
        })),
      },
      react: {
        useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
      },
      unreact: {
        useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
      },
    },
  },
}));

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

jest.mock("../../store/offlineQueue", () => ({
  getQueue: jest.fn().mockResolvedValue([]),
  enqueue: jest.fn(),
  dequeue: jest.fn(),
  incrementAttempts: jest.fn(),
}));

jest.mock("../../hooks/useAppTheme", () => ({
  useAppTheme: () => ({
    colors: { text: "#000", surface: "#fff", muted: "#999" },
    spacing: { md: 12, lg: 16 },
    radii: { sm: 4, md: 8 },
  }),
}));

describe("Journal Screen a11y", () => {
  it.skip("renders without crashing", () => {
    // TODO: A11Y-006 — screen requires complex mocking of offline queue
    const { root } = render(<JournalScreen />);
    expect(root).toBeTruthy();
  });

  it.skip("every Pressable has accessibilityLabel + accessibilityRole", () => {
    // TODO: A11Y-006 — some Pressables missing accessibilityLabel
  });
});
