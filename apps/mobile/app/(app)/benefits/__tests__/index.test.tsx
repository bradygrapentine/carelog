import { render, fireEvent } from "@testing-library/react-native";
import BenefitsScreen from "../index";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockUseApp = jest.fn(() => ({
  orgId: "org-1",
  recipientId: "r-1",
  currentRole: "coordinator",
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: (...args: unknown[]) => mockUseApp(...args),
}));

const mockScreen = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    benefits: {
      screen: {
        useMutation: jest.fn(() => ({ mutate: mockScreen, isPending: false })),
      },
      latest: { useQuery: jest.fn(() => ({ data: null, isLoading: false })) },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

describe("BenefitsScreen", () => {
  it("renders screening questions", () => {
    const { getByText } = render(<BenefitsScreen />);
    expect(getByText("Age 65 or older")).toBeTruthy();
    expect(getByText("Veteran or surviving spouse")).toBeTruthy();
    expect(getByText("Low income household")).toBeTruthy();
  });

  it("calls screen mutation on submit", () => {
    const { getByText } = render(<BenefitsScreen />);
    fireEvent.press(getByText("Check Eligibility"));
    expect(mockScreen).toHaveBeenCalled();
  });

  it("shows non-coordinator message for caregivers", () => {
    mockUseApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "caregiver",
    });
    const { getByText } = render(<BenefitsScreen />);
    expect(getByText(/coordinator/i)).toBeTruthy();
  });
});
