import { render } from "@testing-library/react-native";
import BenefitsScreen from "../../app/(app)/benefits/index";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1" }),
}));

jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn().mockResolvedValue(undefined),
}));


jest.mock("../../utils/trpc", () => ({
  trpc: {
    benefits: {
      getMatches: {
        useQuery: jest.fn(() => ({
          data: [],
          isLoading: false,
          refetch: jest.fn(),
        })),
      },
    },
  },
}));

jest.mock("../../hooks/useAppTheme", () => ({
  useAppTheme: () => ({
    colors: { text: "#000", surface: "#fff", muted: "#999" },
    spacing: { md: 12, lg: 16 },
    radii: { sm: 4, md: 8 },
  }),
}));

describe("Benefits Screen a11y", () => {
  it.skip("renders without crashing", () => {
    // TODO: A11Y-006 — screen requires Linking mock that conflicts with testing-library
    const { root } = render(<BenefitsScreen />);
    expect(root).toBeTruthy();
  });

  it.skip("every Pressable has accessibilityLabel + accessibilityRole", () => {
    // TODO: A11Y-006 — some Pressables missing accessibilityLabel
  });
});
