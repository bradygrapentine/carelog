import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../../../../lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ memberships: { list: { invalidate: vi.fn() } } }),
    memberships: {
      remove: {
        useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
      },
    },
  },
}));

import { TeamPanel } from "../TeamPanel";

function makeProps(
  overrides: Partial<React.ComponentProps<typeof TeamPanel>> = {},
): React.ComponentProps<typeof TeamPanel> {
  return {
    members: [],
    currentUserId: "user-1",
    canInvite: false,
    onInvite: vi.fn().mockResolvedValue(undefined),
    showInvite: false,
    onToggleInvite: vi.fn(),
    ...overrides,
  };
}

const ALICE: React.ComponentProps<typeof TeamPanel>["members"][0] = {
  id: "m1",
  user_id: "user-1",
  role: "coordinator",
  display_name: "Alice Smith",
  email: null,
};
const BOB: React.ComponentProps<typeof TeamPanel>["members"][0] = {
  id: "m2",
  user_id: "user-2",
  role: "caregiver",
  display_name: "Bob Jones",
  email: null,
};

describe("TeamPanel — member list", () => {
  it("shows member display names", () => {
    render(<TeamPanel {...makeProps({ members: [ALICE, BOB] })} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("shows role labels", () => {
    render(<TeamPanel {...makeProps({ members: [ALICE, BOB] })} />);
    expect(screen.getByText("Coordinator")).toBeInTheDocument();
    expect(screen.getByText("Caregiver")).toBeInTheDocument();
  });

  it('shows "you" label next to the current user', () => {
    render(
      <TeamPanel
        {...makeProps({ members: [ALICE, BOB], currentUserId: "user-1" })}
      />,
    );
    expect(screen.getByText("you")).toBeInTheDocument();
  });

  it('does not show "you" label for other members', () => {
    render(
      <TeamPanel {...makeProps({ members: [BOB], currentUserId: "user-1" })} />,
    );
    expect(screen.queryByText("you")).not.toBeInTheDocument();
  });

  it('shows "Just you so far" when members list is empty', () => {
    render(<TeamPanel {...makeProps({ members: [] })} />);
    expect(screen.getByText("Just you so far")).toBeInTheDocument();
  });

  it("shows member count in header", () => {
    render(<TeamPanel {...makeProps({ members: [ALICE, BOB] })} />);
    expect(screen.getByText("2 members")).toBeInTheDocument();
  });

  it('falls back to "?" avatar initial when email is null', () => {
    const noEmail = {
      id: "m3",
      user_id: "user-3",
      role: "supporter",
      email: null,
      display_name: null,
    };
    render(<TeamPanel {...makeProps({ members: [noEmail] })} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});

describe("TeamPanel — invite button", () => {
  it("hides invite button when canInvite is false", () => {
    render(<TeamPanel {...makeProps({ canInvite: false })} />);
    expect(
      screen.queryByRole("button", { name: /invite/i }),
    ).not.toBeInTheDocument();
  });

  it("shows invite button when canInvite is true", () => {
    render(
      <TeamPanel {...makeProps({ canInvite: true, showInvite: false })} />,
    );
    expect(
      screen.getByRole("button", { name: "Invite someone" }),
    ).toBeInTheDocument();
  });

  it("calls onToggleInvite when invite button is clicked", () => {
    const onToggleInvite = vi.fn();
    render(<TeamPanel {...makeProps({ canInvite: true, onToggleInvite })} />);
    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    expect(onToggleInvite).toHaveBeenCalledOnce();
  });

  it('shows "Cancel" label on invite button when form is open', () => {
    render(<TeamPanel {...makeProps({ canInvite: true, showInvite: true })} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("TeamPanel — invite form", () => {
  it("shows invite form when showInvite is true", () => {
    render(<TeamPanel {...makeProps({ canInvite: true, showInvite: true })} />);
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send invite" }),
    ).toBeInTheDocument();
  });

  it("disables send button when email is empty", () => {
    render(<TeamPanel {...makeProps({ canInvite: true, showInvite: true })} />);
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
  });

  it("calls onInvite with email and role on submit", async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined);
    render(
      <TeamPanel
        {...makeProps({ canInvite: true, showInvite: true, onInvite })}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Send invite" }).closest("form")!,
    );
    expect(onInvite).toHaveBeenCalledWith("new@example.com", "caregiver");
  });

  it('shows "Sending..." while the invite is in flight', async () => {
    let resolve!: () => void;
    const onInvite = vi.fn().mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    render(
      <TeamPanel
        {...makeProps({ canInvite: true, showInvite: true, onInvite })}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Send invite" }).closest("form")!,
    );
    expect(
      screen.getByRole("button", { name: "Sending..." }),
    ).toBeInTheDocument();
    resolve();
  });

  it("resets email field after successful invite", async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined);
    render(
      <TeamPanel
        {...makeProps({ canInvite: true, showInvite: true, onInvite })}
      />,
    );
    const input = screen.getByPlaceholderText("Email address");
    fireEvent.change(input, { target: { value: "new@example.com" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Send invite" }).closest("form")!,
    );
    await waitFor(() => expect(input).toHaveValue(""));
  });
});
