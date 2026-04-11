import { render } from "@testing-library/react-native";
import BurnoutScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: jest.fn(() => ({ orgId: "org-1", currentRole: "coordinator" })),
}));

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    burnout: {
      myHistory: {
        useQuery: jest.fn(() => ({ data: [], isLoading: false })),
      },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BurnoutScreen", () => {
  it("shows Check in this week button when not checked in", () => {
    const { getByText } = render(<BurnoutScreen />);
    expect(getByText("Check in this week")).toBeTruthy();
  });

  it("shows Team summary button for coordinator", () => {
    const { getByText } = render(<BurnoutScreen />);
    expect(getByText("Team summary")).toBeTruthy();
  });

  it("hides Team summary button for caregiver", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({ orgId: "org-1", currentRole: "caregiver" });
    const { queryByText } = render(<BurnoutScreen />);
    expect(queryByText("Team summary")).toBeNull();
  });

  it("shows checked-in state when already checked in this week", () => {
    const trpc = require("../../../../utils/trpc").trpc;
    const thisWeek =
      new Date().getFullYear() + "-W" + String(getISOWeek()).padStart(2, "0");
    trpc.burnout.myHistory.useQuery.mockReturnValueOnce({
      data: [{ week_stamp: thisWeek, score: 3 }],
      isLoading: false,
    });
    const { getByText } = render(<BurnoutScreen />);
    expect(getByText("Checked in this week ✓")).toBeTruthy();
  });
});

function getISOWeek() {
  const d = new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const dayOfYear = Math.ceil(
    (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000,
  );
  return Math.ceil((dayOfYear + (jan4.getDay() || 7) - 1) / 7);
}
