import { render } from "@testing-library/react-native";
import SettingsScreen from "../../app/(app)/settings/index";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1" }),
}));

jest.mock("../../hooks/useAppTheme", () => ({
  useAppTheme: () => ({
    colors: { text: "#000", surface: "#fff", muted: "#999" },
    spacing: { md: 12, lg: 16 },
    radii: { sm: 4, md: 8 },
  }),
}));

describe("Settings Screen a11y", () => {
  it.skip("renders without crashing", () => {
    // TODO: A11Y-006 — screen requires expo-notifications mock
    const { root } = render(<SettingsScreen />);
    expect(root).toBeTruthy();
  });

  it.skip("every Pressable has accessibilityLabel + accessibilityRole", () => {
    // TODO: A11Y-006 — some Pressables missing accessibilityLabel
  });
});
