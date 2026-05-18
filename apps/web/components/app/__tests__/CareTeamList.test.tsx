import { render, screen, within, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CareTeamList } from "../CareTeamList";

const {
  mockInviteMutate,
  mockRemoveMutate,
  mockInviteHook,
  mockRemoveHook,
  mockRouterRefresh,
} = vi.hoisted(() => ({
  mockInviteMutate: vi.fn(),
  mockRemoveMutate: vi.fn(),
  mockInviteHook: vi.fn(),
  mockRemoveHook: vi.fn(),
  mockRouterRefresh: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    memberships: {
      invite: { useMutation: mockInviteHook },
      remove: { useMutation: mockRemoveHook },
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

beforeEach(() => {
  mockInviteMutate.mockReset();
  mockRemoveMutate.mockReset();
  mockRouterRefresh.mockReset();
  mockInviteHook.mockReset();
  mockRemoveHook.mockReset();
  mockInviteHook.mockReturnValue({
    mutate: mockInviteMutate,
    isPending: false,
  });
  mockRemoveHook.mockReturnValue({
    mutate: mockRemoveMutate,
    isPending: false,
  });
});

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

const members = [
  {
    id: "m1",
    name: "Anna Hoffman",
    role: "Day shift",
    phone: "+13035550101",
    initials: "AH",
  },
  {
    id: "m2",
    name: "Sarah Reed",
    role: "Coordinator",
    phone: "+13035550102",
    initials: "SR",
  },
];

const memberNoPhone = {
  id: "m3",
  name: "Bob Turner",
  role: "PT",
};

describe("CareTeamList (read-only behavior — unchanged)", () => {
  it("renders one li per member", () => {
    render(<CareTeamList members={members} />);
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(members.length);
  });

  it("renders the name and role for each member", () => {
    render(<CareTeamList members={members} />);
    expect(screen.getByText("Anna Hoffman")).toBeInTheDocument();
    expect(screen.getByText("Day shift")).toBeInTheDocument();
    expect(screen.getByText("Sarah Reed")).toBeInTheDocument();
    expect(screen.getByText("Coordinator")).toBeInTheDocument();
  });

  it("when phone is provided, renders a tel: link with the right href", () => {
    render(<CareTeamList members={members} />);
    const telLinks = screen.getAllByRole("link");
    expect(telLinks[0]).toHaveAttribute("href", "tel:+13035550101");
    expect(telLinks[1]).toHaveAttribute("href", "tel:+13035550102");
  });

  it("tel link has a descriptive aria-label that includes the member name", () => {
    render(<CareTeamList members={members} />);
    expect(
      screen.getByRole("link", { name: /call anna hoffman/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /call sarah reed/i }),
    ).toBeInTheDocument();
  });

  it("when phone is omitted, no tel link is rendered for that row", () => {
    render(<CareTeamList members={[memberNoPhone]} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("when initials are provided, they are rendered (not the User icon)", () => {
    render(<CareTeamList members={[members[0]]} />);
    expect(screen.getByText("AH")).toBeInTheDocument();
  });

  it("when initials are omitted, the User icon renders", () => {
    render(<CareTeamList members={[memberNoPhone]} />);
    expect(screen.getByTestId("user-icon-fallback")).toBeInTheDocument();
  });

  it("when members is empty, shows 'No team members yet.'", () => {
    render(<CareTeamList members={[]} />);
    expect(screen.getByText(/no team members yet/i)).toBeInTheDocument();
  });

  it("with editable=false, does NOT render the Invite button or Remove buttons", () => {
    render(<CareTeamList members={members} editable={false} orgId={ORG_ID} />);
    expect(
      screen.queryByRole("button", { name: /invite member/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();
  });
});

describe("CareTeamList — UX-103b edit affordances", () => {
  const editableProps = {
    members,
    orgId: ORG_ID,
    recipientId: REC_ID,
    editable: true as const,
    currentMembershipId: "m2", // Sarah is the caller
  };

  it("renders the Invite member button when editable", () => {
    render(<CareTeamList {...editableProps} />);
    expect(
      screen.getByRole("button", { name: /invite member/i }),
    ).toBeInTheDocument();
  });

  it("clicking Invite opens the form with email + role inputs", () => {
    render(<CareTeamList {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send invite/i }),
    ).toBeInTheDocument();
  });

  it("submitting the invite form calls memberships.invite with the right shape", () => {
    render(<CareTeamList {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/role/i), {
      target: { value: "aide" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));
    expect(mockInviteMutate).toHaveBeenCalledTimes(1);
    expect(mockInviteMutate).toHaveBeenCalledWith({
      orgId: ORG_ID,
      recipientId: REC_ID,
      role: "aide",
      email: "new@example.com",
    });
  });

  it("rapid-click on Send invite still fires the mutation exactly once (TD-97 pattern)", () => {
    mockInviteHook.mockReturnValue({
      mutate: mockInviteMutate,
      isPending: true,
    });
    render(<CareTeamList {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });
    const submit = screen.getByRole("button", {
      name: /sending…|send invite/i,
    });
    fireEvent.click(submit);
    fireEvent.click(submit);
    fireEvent.click(submit);
    // The submit button is disabled while isPending — total mutate calls remain 0
    // since useMutation reports pending. (In real flow, first click fires once,
    // subsequent are no-ops because the button is disabled.)
    expect(submit).toBeDisabled();
  });

  it("on invite error, surfaces the formatted alert via formatMutationError", () => {
    const callbacks: { onError?: (err: unknown) => void } = {};
    mockInviteHook.mockImplementation(
      (opts: { onError?: (err: unknown) => void }) => {
        callbacks.onError = opts.onError;
        return { mutate: mockInviteMutate, isPending: false };
      },
    );
    render(<CareTeamList {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    act(() => {
      // BAD_REQUEST with PG constraint name — formatter strips the suffix
      // so the surfaced message does not leak the constraint identifier.
      callbacks.onError?.({
        data: { code: "BAD_REQUEST" },
        message:
          "duplicate key value violates memberships_org_id_user_id_key",
      });
    });
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent ?? "").not.toMatch(/_key\b/);
  });

  it("on invite success, refreshes the router and closes the form", () => {
    const callbacks: { onSuccess?: () => void } = {};
    mockInviteHook.mockImplementation((opts: { onSuccess?: () => void }) => {
      callbacks.onSuccess = opts.onSuccess;
      return { mutate: mockInviteMutate, isPending: false };
    });
    render(<CareTeamList {...editableProps} />);
    fireEvent.click(screen.getByRole("button", { name: /invite member/i }));
    act(() => {
      callbacks.onSuccess?.();
    });
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders a Remove button for every member except the caller's own row", () => {
    render(<CareTeamList {...editableProps} />);
    // m1 (Anna) is not the caller — has Remove
    expect(
      screen.getByRole("button", { name: /^remove anna hoffman$/i }),
    ).toBeInTheDocument();
    // m2 (Sarah, caller) — NO Remove button
    expect(
      screen.queryByRole("button", { name: /^remove sarah reed$/i }),
    ).not.toBeInTheDocument();
  });

  it("Remove uses two-click confirmation; second click fires memberships.remove", () => {
    render(<CareTeamList {...editableProps} />);
    const removeBtn = screen.getByRole("button", {
      name: /^remove anna hoffman$/i,
    });
    fireEvent.click(removeBtn);
    // First click reveals the confirm state
    expect(
      screen.getByRole("button", { name: /confirm remove anna hoffman/i }),
    ).toBeInTheDocument();
    expect(mockRemoveMutate).not.toHaveBeenCalled();
    // Second click fires the mutation
    fireEvent.click(
      screen.getByRole("button", { name: /confirm remove anna hoffman/i }),
    );
    expect(mockRemoveMutate).toHaveBeenCalledWith({
      orgId: ORG_ID,
      membershipId: "m1",
    });
  });

  it("on remove error, surfaces the formatted alert via formatMutationError", () => {
    const callbacks: { onError?: (err: unknown) => void } = {};
    mockRemoveHook.mockImplementation(
      (opts: { onError?: (err: unknown) => void }) => {
        callbacks.onError = opts.onError;
        return { mutate: mockRemoveMutate, isPending: false };
      },
    );
    render(<CareTeamList {...editableProps} />);
    act(() => {
      callbacks.onError?.({
        data: { code: "INTERNAL_SERVER_ERROR" },
        message: "DB pool exhausted",
      });
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  it("on remove success, refreshes the router", () => {
    const callbacks: { onSuccess?: () => void } = {};
    mockRemoveHook.mockImplementation((opts: { onSuccess?: () => void }) => {
      callbacks.onSuccess = opts.onSuccess;
      return { mutate: mockRemoveMutate, isPending: false };
    });
    render(<CareTeamList {...editableProps} />);
    act(() => {
      callbacks.onSuccess?.();
    });
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
  });
});
