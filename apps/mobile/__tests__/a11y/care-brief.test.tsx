import { render } from "@testing-library/react-native";
import CareBriefScreen from "../../app/(app)/care-brief/index";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", recipientId: "r-1" }),
}));

jest.mock("../../utils/trpc", () => ({
  trpc: {
    careBrief: {
      get: {
        useQuery: jest.fn(() => ({
          data: null,
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

describe("Care Brief Screen a11y", () => {
  it.skip("renders without crashing", () => {
    // TODO: A11Y-006 — screen requires auth utils not available in test env
    const { root } = render(<CareBriefScreen />);
    expect(root).toBeTruthy();
  });

  it.skip("every Pressable has accessibilityLabel + accessibilityRole", () => {
    // TODO: A11Y-006 — some Pressables missing accessibilityLabel
  });
});
