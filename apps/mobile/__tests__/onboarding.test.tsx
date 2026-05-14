import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

// --- Mocks ---

// expo-router
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

// expo-secure-store (replaces AsyncStorage in this project)
const secureStoreData: Record<string, string> = {};
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    secureStoreData[key] = value;
  }),
  getItemAsync: jest.fn(async (key: string) => secureStoreData[key] ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete secureStoreData[key];
  }),
}));

// react-native Alert (jest-expo uses react-native directly in transforms)
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  RN.Alert.alert = jest.fn();
  return RN;
});

// useAppTheme — return stable token values so StyleSheet.create doesn't fail
jest.mock("../hooks/useAppTheme", () => ({
  useAppTheme: () => ({
    scheme: "light",
    colors: {
      primary: "#7c3aed",
      ink: "#1e0a3c",
      surface: "#faf5ff",
      surfaceRaised: "#ffffff",
      textPrimary: "#1e0a3c",
      textSecondary: "#4b5563",
      muted: "#6b7280",
      mutedLight: "#9ca3af",
      border: "#ede9fe",
      borderInput: "#d1d5db",
      white: "#ffffff",
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
    radii: { sm: 6, md: 10, lg: 14, xl: 20, pill: 9999 },
    typography: {},
    fontFamily: {
      regular: "Inter_400Regular",
      medium: "Inter_500Medium",
      semibold: "Inter_600SemiBold",
      bold: "Inter_700Bold",
    },
    shadows: {},
  }),
}));

// scaledFont — just return base size in tests
jest.mock("../lib/font-scale", () => ({
  scaledFont: (base: number) => base,
}));

import * as SecureStore from "expo-secure-store";
import WelcomeScreen from "../app/(auth)/onboarding/welcome";
import CareRecipientScreen from "../app/(auth)/onboarding/care-recipient";
import InviteTeamScreen from "../app/(auth)/onboarding/invite-team";

beforeEach(() => {
  jest.clearAllMocks();
  // Reset in-memory store
  Object.keys(secureStoreData).forEach((k) => delete secureStoreData[k]);
});

// --- Test 1: WelcomeScreen ---
describe("WelcomeScreen", () => {
  it("renders headline and Get started button", () => {
    const { getByText } = render(<WelcomeScreen />);
    expect(getByText("Welcome to Carelog")).toBeTruthy();
    expect(getByText("Get started →")).toBeTruthy();
  });

  it("navigates to care-recipient on button press", () => {
    const { getByText } = render(<WelcomeScreen />);
    fireEvent.press(getByText("Get started →"));
    expect(mockPush).toHaveBeenCalledWith("/(auth)/onboarding/care-recipient");
  });
});

// --- Test 2: CareRecipientScreen ---
describe("CareRecipientScreen", () => {
  it("renders headline and inputs", () => {
    const { getByText, getByLabelText } = render(<CareRecipientScreen />);
    expect(getByText("Who are you caring for?")).toBeTruthy();
    expect(getByLabelText("Care recipient display name")).toBeTruthy();
    expect(getByLabelText("Your name as shown to team members")).toBeTruthy();
  });

  it("does not navigate when fields are empty", () => {
    const { getByText } = render(<CareRecipientScreen />);
    fireEvent.press(getByText("Continue →"));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates when both fields are filled", () => {
    const { getByText, getByLabelText } = render(<CareRecipientScreen />);

    fireEvent.changeText(getByLabelText("Care recipient display name"), "Mom");
    fireEvent.changeText(
      getByLabelText("Your name as shown to team members"),
      "Alex",
    );
    fireEvent.press(getByText("Continue →"));

    expect(mockPush).toHaveBeenCalledWith("/(auth)/onboarding/invite-team");
  });
});

// --- Test 3: InviteTeamScreen — Skip for now ---
describe("InviteTeamScreen", () => {
  it("renders headline and both buttons", () => {
    const { getByText } = render(<InviteTeamScreen />);
    expect(getByText("Invite your team")).toBeTruthy();
    expect(getByText("Send invites")).toBeTruthy();
    expect(getByText("Skip for now")).toBeTruthy();
  });

  it("Skip for now: writes AsyncStorage flag and navigates to /(app)", async () => {
    const { getByText } = render(<InviteTeamScreen />);
    fireEvent.press(getByText("Skip for now"));

    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "v1:carelog:onboarding_complete",
        "true",
      );
      expect(mockReplace).toHaveBeenCalledWith("/(app)");
    });
  });

  it("Send invites: writes AsyncStorage flag and navigates to /(app)", async () => {
    const { getByText } = render(<InviteTeamScreen />);
    fireEvent.press(getByText("Send invites"));

    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "v1:carelog:onboarding_complete",
        "true",
      );
      expect(mockReplace).toHaveBeenCalledWith("/(app)");
    });
  });
});

// --- Test 4: Integration flow ---
describe("Onboarding flow integration", () => {
  it("welcome → care-recipient → invite-team → /(app)", async () => {
    // Step 1: Welcome
    const { getByText: getWelcome, unmount: unmountWelcome } = render(
      <WelcomeScreen />,
    );
    fireEvent.press(getWelcome("Get started →"));
    expect(mockPush).toHaveBeenCalledWith("/(auth)/onboarding/care-recipient");
    unmountWelcome();

    // Step 2: Care Recipient
    jest.clearAllMocks();
    const {
      getByText: getCare,
      getByLabelText,
      unmount: unmountCare,
    } = render(<CareRecipientScreen />);
    fireEvent.changeText(getByLabelText("Care recipient display name"), "Mom");
    fireEvent.changeText(
      getByLabelText("Your name as shown to team members"),
      "Alex",
    );
    fireEvent.press(getCare("Continue →"));
    expect(mockPush).toHaveBeenCalledWith("/(auth)/onboarding/invite-team");
    unmountCare();

    // Step 3: Invite Team — skip
    jest.clearAllMocks();
    const { getByText: getInvite } = render(<InviteTeamScreen />);
    fireEvent.press(getInvite("Skip for now"));

    await waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "v1:carelog:onboarding_complete",
        "true",
      );
      expect(mockReplace).toHaveBeenCalledWith("/(app)");
    });
  });
});
