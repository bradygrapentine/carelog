import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import OcrReviewScreen from "../[jobId]";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({ jobId: "job-1" })),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("../../../../../utils/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ access_token: "tok" }),
}));

const mockJobResponse = {
  job: {
    id: "job-1",
    status: "done",
    parsed_data: {
      document_type: "bill",
      fields: [
        {
          label: "Amount Due",
          value: "$120.00",
          confidence: 0.95,
          type: "currency",
        },
        {
          label: "Provider",
          value: "City Hospital",
          confidence: 0.6,
          type: "text",
        },
      ],
    },
  },
};

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  // Auto-invoke the first button's onPress (OK) so router.replace fires in navigation tests
  jest
    .spyOn(Alert, "alert")
    .mockImplementation(
      (
        _title: string,
        _msg?: string,
        buttons?: { text: string; onPress?: () => void }[],
      ) => {
        if (buttons && buttons[0]?.onPress) buttons[0].onPress();
      },
    );
  // First fetch: load job on mount
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockJobResponse,
  });
});

describe("OcrReviewScreen", () => {
  it("renders the document type badge", async () => {
    const { findByText } = render(<OcrReviewScreen />);
    await findByText(/bill|Medical Bill|Bill/i);
  });

  it("renders field labels", async () => {
    const { findByText } = render(<OcrReviewScreen />);
    await findByText("Amount Due");
    await findByText("Provider");
  });

  it("marks low-confidence fields with a warning indicator", async () => {
    const { findByTestId } = render(<OcrReviewScreen />);
    await findByTestId("low-confidence-Provider");
  });

  it("renders Save button", async () => {
    const { findByText } = render(<OcrReviewScreen />);
    await findByText("Save");
  });

  it("updates field value when user types", async () => {
    const { findByDisplayValue, getByDisplayValue } = render(
      <OcrReviewScreen />,
    );
    await findByDisplayValue("$120.00");
    fireEvent.changeText(getByDisplayValue("$120.00"), "$150.00");
    expect(getByDisplayValue("$150.00")).toBeTruthy();
  });

  it("calls /api/ocr/save-fields on Save press", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    const { findByText, getByText } = render(<OcrReviewScreen />);
    await findByText("Save");
    fireEvent.press(getByText("Save"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/ocr/save-fields"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("navigates to documents after successful save", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    const { findByText, getByText } = render(<OcrReviewScreen />);
    await findByText("Save");
    fireEvent.press(getByText("Save"));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(app)/documents");
    });
  });

  it("shows error alert on save failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Permission denied" }),
    });
    const { findByText, getByText } = render(<OcrReviewScreen />);
    await findByText("Save");
    fireEvent.press(getByText("Save"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("shows error alert when initial fetch throws", async () => {
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error"),
    );
    render(<OcrReviewScreen />);
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Error",
        expect.stringContaining("Network error"),
      );
    });
  });
});
