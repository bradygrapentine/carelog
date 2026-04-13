import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import SymptomLogScreen from "../log";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  }),
}));

const mockWrite = jest.fn().mockResolvedValue(undefined);
jest.mock("../../../../hooks/useOfflineWrite", () => ({
  useOfflineWrite: jest.fn(() => ({ write: mockWrite })),
}));

jest.mock("../../../../utils/wave5Utils", () => ({
  APPETITE_OPTIONS: [
    { key: "normal", label: "Normal" },
    { key: "reduced", label: "Reduced" },
  ],
  MOBILITY_OPTIONS: [
    { key: "normal", label: "Normal" },
    { key: "limited", label: "Limited" },
  ],
}));

jest.mock("../../../../utils/journalUtils", () => ({
  MOOD_COLORS: {
    good: { bg: "#f0fdf4", text: "#16a34a" },
    okay: { bg: "#fefce8", text: "#ca8a04" },
    difficult: { bg: "#fff7ed", text: "#ea580c" },
    crisis: { bg: "#fef2f2", text: "#dc2626" },
  },
}));

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockWrite.mockResolvedValue(undefined);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
});

describe("SymptomLogScreen", () => {
  it("renders without crash", () => {
    const { getByText } = render(<SymptomLogScreen />);
    expect(getByText("Step 1 of 4")).toBeTruthy();
  });

  it("shows pain level question on step 0", () => {
    const { getByText } = render(<SymptomLogScreen />);
    expect(getByText("Pain level (0-10)")).toBeTruthy();
  });

  it("advances to mood step when pain level is selected", () => {
    const { getByLabelText, getByText } = render(<SymptomLogScreen />);
    fireEvent.press(getByLabelText("Pain level 5"));
    expect(getByText("How are they feeling?")).toBeTruthy();
  });

  it("can skip pain level step", () => {
    const { getByLabelText, getByText } = render(<SymptomLogScreen />);
    fireEvent.press(getByLabelText("Skip pain level"));
    expect(getByText("How are they feeling?")).toBeTruthy();
  });

  it("handleSubmit shows error alert when write throws", async () => {
    mockWrite.mockRejectedValueOnce(new Error("Network failure"));
    const { getByLabelText } = render(<SymptomLogScreen />);
    fireEvent.press(getByLabelText("Skip pain level"));
    fireEvent.press(getByLabelText("Skip mood"));
    fireEvent.press(getByLabelText("Next step"));
    fireEvent.press(getByLabelText("Save symptoms"));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Error", "Network failure");
    });
  });

  it("selecting a mood option advances to step 2", () => {
    const { getByLabelText, getByText } = render(<SymptomLogScreen />);
    fireEvent.press(getByLabelText("Skip pain level"));
    fireEvent.press(getByLabelText("good mood"));
    expect(getByText("Appetite")).toBeTruthy();
  });

  it("selecting appetite option at step 2 sets appetite", () => {
    const { getByLabelText, getByText } = render(<SymptomLogScreen />);
    fireEvent.press(getByLabelText("Skip pain level"));
    fireEvent.press(getByLabelText("Skip mood"));
    fireEvent.press(getByLabelText("Normal appetite"));
    expect(getByText("Appetite")).toBeTruthy();
  });

  it("selecting mobility option at step 2 sets mobility", () => {
    const { getByLabelText } = render(<SymptomLogScreen />);
    fireEvent.press(getByLabelText("Skip pain level"));
    fireEvent.press(getByLabelText("Skip mood"));
    fireEvent.press(getByLabelText("Normal mobility"));
    expect(getByLabelText("Normal mobility")).toBeTruthy();
  });

  it("Back button on step 1 returns to step 0", () => {
    const { getByLabelText, getByText } = render(<SymptomLogScreen />);
    fireEvent.press(getByLabelText("Skip pain level"));
    fireEvent.press(getByLabelText("Previous step"));
    expect(getByText("Pain level (0-10)")).toBeTruthy();
  });

  it("calls write on submit at final step", async () => {
    const { getByLabelText } = render(<SymptomLogScreen />);
    fireEvent.press(getByLabelText("Skip pain level")); // step 1
    fireEvent.press(getByLabelText("Skip mood")); // step 2
    fireEvent.press(getByLabelText("Next step")); // step 3
    fireEvent.press(getByLabelText("Save symptoms"));
    await Promise.resolve();
    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "symptom",
        entry_kind: "symptom_reading",
        recipient_id: "r-1",
      }),
    );
  });
});
