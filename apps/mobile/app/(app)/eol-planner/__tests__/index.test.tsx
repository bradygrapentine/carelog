import { render, fireEvent } from "@testing-library/react-native";
import EolPlannerScreen from "../index";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock("../../../../context/AppContext", () => ({
  useApp: jest.fn(() => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  })),
}));

const mockUpsert = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    eolPlan: {
      get: { useQuery: jest.fn(() => ({ data: null, isLoading: false })) },
      upsert: {
        useMutation: jest.fn(() => ({ mutate: mockUpsert, isPending: false })),
      },
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

describe("EolPlannerScreen", () => {
  it("renders form fields for coordinator", () => {
    const { getByPlaceholderText } = render(<EolPlannerScreen />);
    expect(getByPlaceholderText(/proxy name/i)).toBeTruthy();
  });

  it("shows locked state for non-coordinator", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "caregiver",
    });
    const { getByText } = render(<EolPlannerScreen />);
    expect(getByText(/coordinator/i)).toBeTruthy();
  });

  it("calls upsert on save", () => {
    const { getByText } = render(<EolPlannerScreen />);
    fireEvent.press(getByText("Save"));
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("pre-fills form from existing plan", () => {
    const { trpc } = require("../../../../utils/trpc");
    trpc.eolPlan.get.useQuery.mockReturnValueOnce({
      data: {
        healthcare_proxy: "Jane Doe",
        resuscitation_pref: "dnr",
        funeral_pref: "",
        legacy_message: "",
        attorney_name: "",
        attorney_contact: "",
      },
      isLoading: false,
    });
    const { getByDisplayValue } = render(<EolPlannerScreen />);
    expect(getByDisplayValue("Jane Doe")).toBeTruthy();
  });
});
