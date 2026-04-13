import { render, fireEvent, waitFor } from "@testing-library/react-native";
import TeamScreen from "../index";

jest.mock("../../../../context/AppContext", () => ({
  useApp: jest.fn(() => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  })),
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
    email: "bob@example.com",
    role: "caregiver",
    accepted_at: "2026-02-01",
  },
];

const mockMutateAsync = jest.fn().mockResolvedValue({});
const mockRefetch = jest.fn();

jest.mock("../../../../utils/trpc", () => ({
  trpc: {
    memberships: {
      list: {
        useQuery: jest.fn(() => ({
          data: mockMembers,
          isLoading: false,
          refetch: mockRefetch,
        })),
      },
      invite: {
        useMutation: jest.fn(() => ({
          mutateAsync: mockMutateAsync,
          isPending: false,
        })),
      },
    },
  },
}));

jest.mock("../../../../utils/wave5Utils", () => ({
  canInvite: (role: string | null) => role === "coordinator",
}));

beforeEach(() => jest.clearAllMocks());

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

  it("shows empty state when no members", () => {
    const { trpc } = require("../../../../utils/trpc");
    trpc.memberships.list.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      refetch: mockRefetch,
    });
    const { getByText } = render(<TeamScreen />);
    expect(getByText("No team members yet.")).toBeTruthy();
  });

  it("shows invite FAB for coordinator", () => {
    const { getByLabelText } = render(<TeamScreen />);
    expect(getByLabelText("Invite team member")).toBeTruthy();
  });

  it("hides invite FAB for supporter", () => {
    const { useApp } = require("../../../../context/AppContext");
    useApp.mockReturnValueOnce({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "supporter",
    });
    const { queryByLabelText } = render(<TeamScreen />);
    expect(queryByLabelText("Invite team member")).toBeNull();
  });

  it("opens invite modal when FAB pressed", () => {
    const { getByLabelText, getByText } = render(<TeamScreen />);
    fireEvent.press(getByLabelText("Invite team member"));
    expect(getByText("Invite team member")).toBeTruthy();
  });

  it("closes invite modal when Cancel pressed", () => {
    const { getByLabelText, queryByPlaceholderText } = render(<TeamScreen />);
    fireEvent.press(getByLabelText("Invite team member"));
    fireEvent.press(getByLabelText("Cancel"));
    expect(queryByPlaceholderText("Email address")).toBeNull();
  });

  it("role chip press changes selected role", () => {
    const { getByLabelText } = render(<TeamScreen />);
    fireEvent.press(getByLabelText("Invite team member"));
    fireEvent.press(getByLabelText("aide role"));
    expect(getByLabelText("aide role")).toBeTruthy();
  });

  it("submits invite with email and selected role", async () => {
    const { getByLabelText, getByPlaceholderText } = render(<TeamScreen />);
    fireEvent.press(getByLabelText("Invite team member"));
    fireEvent.changeText(
      getByPlaceholderText("Email address"),
      "new@example.com",
    );
    fireEvent.press(getByLabelText("aide role"));
    fireEvent.press(getByLabelText("Send invite"));
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: "org-1",
          email: "new@example.com",
          role: "aide",
        }),
      );
    });
  });

  it("Send invite is disabled when email is empty", () => {
    const { getByLabelText } = render(<TeamScreen />);
    fireEvent.press(getByLabelText("Invite team member"));
    const btn = getByLabelText("Send invite");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });
});
