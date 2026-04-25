import { render, fireEvent, waitFor } from "@testing-library/react-native";
import MedicationsScreen from "../index";

jest.mock("../../../../utils/watchBridge", () => ({
  writeWatchData: jest.fn(),
}));

jest.mock("../../../../hooks/useSyncStatus", () => ({
  useSyncStatus: jest.fn().mockReturnValue("synced"),
}));

const mockWrite = jest.fn().mockResolvedValue(undefined);
jest.mock("../../../../hooks/useOfflineWrite", () => ({
  useOfflineWrite: () => ({ write: mockWrite }),
}));

const mockScheduled = [
  {
    id: "sched-1",
    scheduled_time: "08:00",
    medications: [{ id: "med-1", drug_name: "Metformin", dosage: "500mg" }],
  },
  {
    id: "sched-2",
    scheduled_time: "14:00",
    medications: [{ id: "med-2", drug_name: "Lisinopril", dosage: "10mg" }],
  },
];

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    medications: {
      listScheduled: {
        useQuery: jest.fn(() => ({
          data: mockScheduled,
          isLoading: false,
          refetch: jest.fn(),
        })),
      },
      todayLog: {
        useQuery: jest.fn(() => ({ data: [] })),
      },
      logAdministration: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    careEvents: {
      insert: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
    symptoms: {
      log: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
  },
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1" }),
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

describe("MedicationsScreen", () => {
  it("renders scheduled medications", () => {
    const { getByText } = render(<MedicationsScreen />);
    expect(getByText("Metformin")).toBeTruthy();
    expect(getByText("500mg · 08:00")).toBeTruthy();
    expect(getByText("Lisinopril")).toBeTruthy();
    expect(getByText("10mg · 14:00")).toBeTruthy();
  });

  it("renders empty state when no medications", () => {
    const trpc = require("../../../../utils/trpc").trpc;
    trpc.medications.listScheduled.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    const { getByText } = render(<MedicationsScreen />);
    expect(getByText(/No medications scheduled today/)).toBeTruthy();
  });

  it("shows Mark given button for unadministered meds", () => {
    const { getAllByText } = render(<MedicationsScreen />);
    const buttons = getAllByText("Mark given");
    expect(buttons).toHaveLength(2);
  });

  it("shows Given status for administered meds", () => {
    const trpc = require("../../../../utils/trpc").trpc;
    trpc.medications.todayLog.useQuery.mockReturnValueOnce({
      data: [
        { medication_id: "med-1", scheduled_time: "08:00", action: "given" },
      ],
    });
    const { getByText, getAllByText } = render(<MedicationsScreen />);
    expect(getByText("✓ Given")).toBeTruthy();
    expect(getAllByText("Mark given")).toHaveLength(1);
  });

  it("logs medication via offline write when Mark given pressed", async () => {
    const { getAllByText } = render(<MedicationsScreen />);
    fireEvent.press(getAllByText("Mark given")[0]);

    await waitFor(() => {
      expect(mockWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: "medication",
          entry_kind: "medication_log",
          payload: expect.objectContaining({
            medication_id: "med-1",
            action: "given",
          }),
        }),
      );
    });
  });
});
