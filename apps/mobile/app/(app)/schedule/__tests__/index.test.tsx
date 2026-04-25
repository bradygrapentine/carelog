import { render } from "@testing-library/react-native";
import ScheduleScreen from "../index";

jest.mock("../../../../utils/watchBridge", () => ({
  writeWatchData: jest.fn(),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1" }),
}));

const mockShifts = [
  {
    id: "shift-1",
    assignee_user_id: "user-1",
    start_at: "2026-04-11T08:00:00Z",
    end_at: "2026-04-11T16:00:00Z",
    notes: "Morning shift",
  },
  {
    id: "shift-2",
    assignee_user_id: "user-2",
    start_at: "2026-04-12T08:00:00Z",
    end_at: "2026-04-12T16:00:00Z",
    notes: "Afternoon shift",
  },
];

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    shifts: {
      list: {
        useQuery: jest.fn(() => ({ data: mockShifts, isLoading: false })),
        invalidate: jest.fn(),
      },
      complete: {
        useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
      },
    },
    shiftTradeRequests: {
      create: {
        useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
      },
    },
    careEvents: {
      insert: {
        useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
      },
    },
    useUtils: jest.fn(() => ({
      shifts: { list: { invalidate: jest.fn() } },
    })),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ScheduleScreen", () => {
  it("renders shift notes", () => {
    const { getByText } = render(<ScheduleScreen />);
    expect(getByText("Morning shift")).toBeTruthy();
    expect(getByText("Afternoon shift")).toBeTruthy();
  });

  it("renders Next 7 days heading", () => {
    const { getByText } = render(<ScheduleScreen />);
    expect(getByText("Next 7 days")).toBeTruthy();
  });

  it("renders empty state when no shifts", () => {
    const trpc = require("../../../../utils/trpc").trpc;
    trpc.shifts.list.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
    });
    const { getByText } = render(<ScheduleScreen />);
    expect(
      getByText("No shifts coming up. Ask your coordinator to add coverage."),
    ).toBeTruthy();
  });
});
