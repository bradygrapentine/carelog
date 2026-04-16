import { render } from "@testing-library/react-native";
import OrgSelectorScreen from "../../app/(app)/index";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../context/AppContext", () => ({
  useApp: () => ({ orgId: "org-1", setOrg: jest.fn() }),
}));

jest.mock("../../utils/trpc", () => ({
  trpc: {
    organizations: {
      list: {
        useQuery: jest.fn(() => ({
          data: [{ id: "org-1", name: "Test Org" }],
          isLoading: false,
        })),
      },
    },
  },
}));

jest.mock("../../hooks/useAppTheme", () => ({
  useAppTheme: () => ({
    colors: {
      surfaceRaised: "#fff",
      borderNeutral: "#ccc",
      mutedLight: "#999",
    },
    spacing: { lg: 16 },
    radii: { md: 8 },
  }),
}));

describe("OrgSelector Screen a11y", () => {
  it.skip("renders without crashing", () => {
    // TODO: A11Y-006 — index screen is initial onboarding, complex auth flow
    const { root } = render(<OrgSelectorScreen />);
    expect(root).toBeTruthy();
  });
});
