import { render } from "@testing-library/react-native";
import TeamScreen from "../index";

jest.mock("../../../../context/AppContext", () => ({
  useApp: () => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  }),
}));

const mockMembers = [
  {
    id: "m1",
    display_name: "Alice",
    role: "coordinator",
    accepted_at: "2026-01-01",
  },
  {
    id: "m2",
    display_name: "Bob",
    role: "caregiver",
    accepted_at: "2026-02-01",
  },
];

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    memberships: {
      list: {
        useQuery: jest.fn(() => ({
          data: mockMembers,
          isLoading: false,
          refetch: jest.fn(),
        })),
      },
      invite: {
        useMutation: (opts?: {
          onSuccess?: () => void;
          onError?: (e: Error) => void;
        }) => ({
          mutateAsync: jest.fn().mockResolvedValue({}),
          isPending: false,
        }),
      },
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("TeamScreen", () => {
  it("renders team member names", () => {
    const { getByText } = render(<TeamScreen />);
    expect(getByText("Alice")).toBeTruthy();
    expect(getByText("Bob")).toBeTruthy();
  });

  it("shows role badges", () => {
    const { getByText } = render(<TeamScreen />);
    expect(getByText("coordinator")).toBeTruthy();
    expect(getByText("caregiver")).toBeTruthy();
  });
});
