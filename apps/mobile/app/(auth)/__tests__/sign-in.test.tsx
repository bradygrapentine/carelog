import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SignInScreen from "../sign-in";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("../../../utils/supabase", () => ({
  supabase: {
    auth: { signInWithOtp: jest.fn() },
  },
}));

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
}));

let mockSignInWithOtp: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSignInWithOtp = require("../../../utils/supabase").supabase.auth
    .signInWithOtp;
  mockSignInWithOtp.mockResolvedValue({ error: null });
});

describe("SignInScreen", () => {
  it("renders email input", () => {
    const { getByPlaceholderText } = render(<SignInScreen />);
    expect(getByPlaceholderText("your@email.com")).toBeTruthy();
  });

  it("renders Send code button", () => {
    const { getByText } = render(<SignInScreen />);
    expect(getByText("Send code")).toBeTruthy();
  });

  it("calls signInWithOtp with trimmed lowercase email", async () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(
      getByPlaceholderText("your@email.com"),
      "  Test@Example.com  ",
    );
    fireEvent.press(getByText("Send code"));

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@example.com" }),
      );
    });
  });

  it("navigates to verify after successful OTP send", async () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(
      getByPlaceholderText("your@email.com"),
      "user@example.com",
    );
    fireEvent.press(getByText("Send code"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/(auth)/verify");
    });
  });
});
