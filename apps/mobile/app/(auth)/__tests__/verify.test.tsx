import { render, fireEvent, waitFor } from "@testing-library/react-native";
import VerifyScreen from "../verify";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
}));

jest.mock("../../../utils/supabase", () => ({
  supabase: {
    auth: { verifyOtp: jest.fn() },
  },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => {
    if (key === "pending_email") return Promise.resolve("test@example.com");
    if (key === "pending_invite_token") return Promise.resolve(null);
    return Promise.resolve(null);
  }),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

let mockVerifyOtp: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyOtp = require("../../../utils/supabase").supabase.auth.verifyOtp;
  mockVerifyOtp.mockResolvedValue({ error: null });
});

describe("VerifyScreen", () => {
  it("renders OTP code input", () => {
    const { getByPlaceholderText } = render(<VerifyScreen />);
    expect(getByPlaceholderText("123456")).toBeTruthy();
  });

  it("renders Verify button", () => {
    const { getByText } = render(<VerifyScreen />);
    expect(getByText("Verify")).toBeTruthy();
  });

  it("verifies OTP and navigates on success", async () => {
    const { getByPlaceholderText, getByText } = render(<VerifyScreen />);
    // Wait for email to load from SecureStore into subtitle
    await waitFor(() => getByText(/test@example\.com/));
    fireEvent.changeText(getByPlaceholderText("123456"), "654321");
    fireEvent.press(getByText("Verify"));

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          token: "654321",
          type: "email",
        }),
      );
    });
  });

  it("navigates to app after successful verify", async () => {
    const { getByPlaceholderText, getByText } = render(<VerifyScreen />);
    await waitFor(() => getByText(/test@example\.com/));
    fireEvent.changeText(getByPlaceholderText("123456"), "654321");
    fireEvent.press(getByText("Verify"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(app)");
    });
  });
});
