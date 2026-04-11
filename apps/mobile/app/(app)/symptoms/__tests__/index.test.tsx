import { render } from "@testing-library/react-native";
import SymptomsScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../hooks/useSyncStatus", () => ({
  useSyncStatus: jest.fn().mockReturnValue("synced"),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  }),
}));

const mockReadings = [
  {
    id: "r1",
    pain_level: 7,
    mood: "difficult",
    appetite: null,
    mobility: null,
    notes: null,
    recorded_at: "2026-04-11T10:00:00Z",
  },
];

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    symptoms: {
      list: {
        useQuery: jest.fn(() => ({ data: mockReadings, isLoading: false })),
      },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SymptomsScreen", () => {
  it("renders symptom readings", () => {
    const { getByText } = render(<SymptomsScreen />);
    expect(getByText("Pain: 7/10")).toBeTruthy();
  });

  it("renders empty state when no readings", () => {
    const trpc = require("../../../../utils/trpc").trpc;
    trpc.symptoms.list.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
    });
    const { getByText } = render(<SymptomsScreen />);
    expect(getByText("No symptom readings yet.")).toBeTruthy();
  });

  it("shows Log symptoms button for coordinator", () => {
    const { getByText } = render(<SymptomsScreen />);
    expect(getByText("Log symptoms")).toBeTruthy();
  });

  it("shows offline banner when offline", () => {
    const { useSyncStatus } = require("../../../../hooks/useSyncStatus");
    useSyncStatus.mockReturnValue("offline");
    const { getByText } = render(<SymptomsScreen />);
    expect(getByText(/Offline/)).toBeTruthy();
  });
});
