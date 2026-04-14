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
    expect(getByText("+ Generate")).toBeTruthy();
  });

  it("hides Generate Brief for non-coordinator", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "caregiver",
    });
    const { queryByText } = render(<CareBriefScreen />);
    expect(queryByText("+ Generate")).toBeNull();
  });

  it("shows share URL after successful generation", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ shareToken: "tok123" }),
    });
    const { getByText, findByText } = render(<CareBriefScreen />);
    fireEvent.press(getByText("+ Generate"));
    await findByText(/tok123/);
  });

  it("shows error on fetch failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    });
    const { getByText, findByText } = render(<CareBriefScreen />);
    fireEvent.press(getByText("+ Generate"));
    await findByText(/Server error/);
  });

  it("shows Copy link button after brief generated", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ shareToken: "tok123" }),
    });
    const { getByText, findByText } = render(<CareBriefScreen />);
    fireEvent.press(getByText("+ Generate"));
    await findByText("Copy link");
    expect(getByText("Copy link")).toBeTruthy();
  });

  it("calls Clipboard.setStringAsync on Copy link press", async () => {
    const Clipboard = require("expo-clipboard");
    Clipboard.setStringAsync.mockResolvedValue(undefined);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ shareToken: "cliptest" }),
    });
    const { getByText, findByText } = render(<CareBriefScreen />);
    fireEvent.press(getByText("+ Generate"));
    await findByText("Copy link");
    fireEvent.press(getByText("Copy link"));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringContaining("cliptest"),
    );
  });

  it("calls revoke endpoint when Revoke pressed and removes brief", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ shareToken: "rev123" }),
      })
      .mockResolvedValueOnce({ ok: true });

    const { getByText, findByText, queryByText } = render(<CareBriefScreen />);
    fireEvent.press(getByText("+ Generate"));
    await findByText("Revoke");
    fireEvent.press(getByText("Revoke"));

    await waitFor(() => {
      expect(queryByText("Revoke")).toBeNull();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("rev123/revoke"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
