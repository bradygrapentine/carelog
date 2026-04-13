import { render, fireEvent, waitFor } from "@testing-library/react-native";
import CareBriefScreen from "../index";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: jest.fn(() => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  })),
}));

jest.mock("../../../../utils/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ access_token: "tok" }),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

global.fetch = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe("CareBriefScreen", () => {
  it("renders Generate Brief button for coordinator", () => {
    const { getByText } = render(<CareBriefScreen />);
    expect(getByText("Generate Care Brief")).toBeTruthy();
  });

  it("hides Generate Brief for non-coordinator", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "caregiver",
    });
    const { queryByText } = render(<CareBriefScreen />);
    expect(queryByText("Generate Care Brief")).toBeNull();
  });

  it("shows share URL after successful generation", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ shareToken: "tok123" }),
    });
    const { getByText, findByText } = render(<CareBriefScreen />);
    fireEvent.press(getByText("Generate Care Brief"));
    await findByText(/tok123/);
  });

  it("shows error on fetch failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    });
    const { getByText, findByText } = render(<CareBriefScreen />);
    fireEvent.press(getByText("Generate Care Brief"));
    await findByText(/Server error/);
  });
});
