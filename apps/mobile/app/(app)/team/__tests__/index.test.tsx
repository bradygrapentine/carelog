import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import TeamScreen from "../index";

jest.mock("../../../../context/AppContext", () => ({
  useApp: jest.fn(() => ({
    orgId: "org-1",
    recipientId: "r-1",
    currentRole: "coordinator",
  })),
}));

// Mock supabase client so getUser() resolves with user-self
jest.mock("../../../../utils/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-self" } },
      }),
    },
  },
}));

const mockMembers = [
  {
    id: "m1",
    user_id: "user-self",
    display_name: "Alice",
    role: "coordinator",
    accepted_at: "2026-01-01",
  },
  {
    id: "m2",
    user_id: "user-bob",
    display_name: "Bob",
    email: "bob@example.com",
    role: "caregiver",
    accepted_at: "2026-02-01",
  },
  {
    id: "m3",
    user_id: "user-other",
    display_name: "Carol",
    role: "caregiver",
    accepted_at: "2026-03-01",
  },
];

const mockMutateAsync = jest.fn().mockResolvedValue({});
const mockChangeRoleMutate = jest.fn();
const mockRemoveMutate = jest.fn();
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
      changeRole: {
        useMutation: jest.fn(() => ({
          mutate: mockChangeRoleMutate,
          isPending: false,
        })),
      },
      remove: {
        useMutation: jest.fn(() => ({
          mutate: mockRemoveMutate,
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
    const { getByText, getAllByText } = render(<TeamScreen />);
    expect(getByText("coordinator")).toBeTruthy();
    // Bob and Carol are both caregivers — expect at least one badge
    expect(getAllByText("caregiver").length).toBeGreaterThanOrEqual(1);
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

  it("inviteMut onSuccess closes modal and shows Invite sent alert", () => {
    jest.spyOn(Alert, "alert");
    const { trpc } = require("../../../../utils/trpc");
    let capturedOpts: { onSuccess?: () => void } | undefined;
    trpc.memberships.invite.useMutation.mockImplementation(
      (opts: { onSuccess?: () => void }) => {
        capturedOpts = opts;
        return { mutateAsync: mockMutateAsync, isPending: false };
      },
    );
    const { getByLabelText, queryByText } = render(<TeamScreen />);
    fireEvent.press(getByLabelText("Invite team member"));
    act(() => {
      capturedOpts?.onSuccess?.();
    });
    expect(Alert.alert).toHaveBeenCalledWith("Invite sent");
    expect(queryByText("Invite team member")).toBeNull();
  });

  it("inviteMut onError shows error alert", () => {
    jest.spyOn(Alert, "alert");
    const { trpc } = require("../../../../utils/trpc");
    let capturedOpts:
      | { onError?: (err: { message: string }) => void }
      | undefined;
    trpc.memberships.invite.useMutation.mockImplementation(
      (opts: { onError?: (err: { message: string }) => void }) => {
        capturedOpts = opts;
        return { mutateAsync: mockMutateAsync, isPending: false };
      },
    );
    render(<TeamScreen />);
    act(() => {
      capturedOpts?.onError?.({ message: "Already invited" });
    });
    expect(Alert.alert).toHaveBeenCalledWith("Error", "Already invited");
  });

  // ─── Admin action tests ────────────────────────────────────────────────────

  it("tapping a non-self member row shows Alert with Change role and Remove member", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByLabelText } = render(<TeamScreen />);
    // Wait for getUser to resolve so currentUserId is set
    await act(async () => {});
    fireEvent.press(getByLabelText("Manage Carol"));
    expect(alertSpy).toHaveBeenCalledWith(
      "Carol",
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ text: "Change role" }),
        expect.objectContaining({ text: "Remove member" }),
      ]),
    );
  });

  it("tapping Change role shows a second Alert with 4 role options", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByLabelText } = render(<TeamScreen />);
    await act(async () => {});
    fireEvent.press(getByLabelText("Manage Carol"));

    // Find and invoke the "Change role" button callback from the first alert
    const firstAlertButtons = alertSpy.mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    const changeRoleBtn = firstAlertButtons.find(
      (b) => b.text === "Change role",
    );
    act(() => changeRoleBtn?.onPress?.());

    // The second Alert call should contain 4 role options
    const secondAlertButtons = alertSpy.mock.calls[1][2] as {
      text: string;
    }[];
    const roleTexts = secondAlertButtons.map((b) => b.text.toLowerCase());
    expect(roleTexts).toEqual(
      expect.arrayContaining(["coordinator", "caregiver", "aide", "supporter"]),
    );
  });

  it("selecting a role in the second Alert calls changeRoleMut.mutate with correct args", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByLabelText } = render(<TeamScreen />);
    await act(async () => {});
    fireEvent.press(getByLabelText("Manage Carol"));

    const firstAlertButtons = alertSpy.mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    act(() => {
      firstAlertButtons.find((b) => b.text === "Change role")?.onPress?.();
    });

    const secondAlertButtons = alertSpy.mock.calls[1][2] as {
      text: string;
      onPress?: () => void;
    }[];
    // Carol is caregiver — pick coordinator to trigger a role change
    act(() => {
      secondAlertButtons.find((b) => b.text === "Coordinator")?.onPress?.();
    });

    expect(mockChangeRoleMutate).toHaveBeenCalledWith({
      orgId: "org-1",
      membershipId: "m3",
      role: "coordinator",
    });
  });

  it("tapping Remove member shows a confirmation Alert", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByLabelText } = render(<TeamScreen />);
    await act(async () => {});
    fireEvent.press(getByLabelText("Manage Carol"));

    const firstAlertButtons = alertSpy.mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    act(() => {
      firstAlertButtons.find((b) => b.text === "Remove member")?.onPress?.();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Remove member",
      expect.stringContaining("Carol"),
      expect.arrayContaining([
        expect.objectContaining({ text: "Remove" }),
        expect.objectContaining({ text: "Cancel" }),
      ]),
    );
  });

  it("confirming removal calls removeMut.mutate with correct membershipId", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByLabelText } = render(<TeamScreen />);
    await act(async () => {});
    fireEvent.press(getByLabelText("Manage Carol"));

    const firstAlertButtons = alertSpy.mock.calls[0][2] as {
      text: string;
      onPress?: () => void;
    }[];
    act(() => {
      firstAlertButtons.find((b) => b.text === "Remove member")?.onPress?.();
    });

    const confirmButtons = alertSpy.mock.calls[1][2] as {
      text: string;
      onPress?: () => void;
    }[];
    act(() => {
      confirmButtons.find((b) => b.text === "Remove")?.onPress?.();
    });

    expect(mockRemoveMutate).toHaveBeenCalledWith({
      orgId: "org-1",
      membershipId: "m3",
    });
  });

  it("self row does not show action Alert when tapped", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByLabelText } = render(<TeamScreen />);
    await act(async () => {});
    // Alice is the self row — label is just the name (canAdmin=false)
    fireEvent.press(getByLabelText("Alice"));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("non-coordinator: all rows are non-interactive (disabled)", async () => {
    const { useApp } = require("../../../../context/AppContext");
    // Use mockReturnValue (not Once) so all re-renders get the caregiver role
    useApp.mockReturnValue({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "caregiver",
    });
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByLabelText } = render(<TeamScreen />);
    await act(async () => {});
    // When currentRole is caregiver, canAdmin=false, so label is just memberName
    const carolRow = getByLabelText("Carol");
    expect(carolRow.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(carolRow);
    expect(alertSpy).not.toHaveBeenCalled();
    // Restore default mock
    useApp.mockReturnValue({
      orgId: "org-1",
      recipientId: "r-1",
      currentRole: "coordinator",
    });
  });
});
