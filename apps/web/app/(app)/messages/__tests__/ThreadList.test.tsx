// apps/web/app/(app)/messages/__tests__/ThreadList.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThreadList } from "../ThreadList";
import { trpc } from "@/lib/trpc";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    messages: {
      listThreads: { useQuery: vi.fn() },
    },
  },
}));

const BASE_PROPS = { orgId: "org-uuid-1", userId: "user-uuid-1" };

function setup(
  overrides: Partial<{ data: unknown[]; isLoading: boolean }> = {},
) {
  const { data = [], isLoading = false } = overrides;
  vi.mocked(trpc.messages.listThreads.useQuery).mockReturnValue({
    data,
    isLoading,
  } as unknown as ReturnType<typeof trpc.messages.listThreads.useQuery>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ThreadList", () => {
  it("renders loading skeletons when isLoading is true", () => {
    setup({ isLoading: true });
    render(<ThreadList {...BASE_PROPS} />);
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(3);
  });

  it("renders 'No conversations yet' when threads are empty", () => {
    setup({ data: [] });
    render(<ThreadList {...BASE_PROPS} />);
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
  });

  it("renders thread buttons with correct labels for DM threads", () => {
    setup({
      data: [
        {
          id: "t1",
          thread_type: "dm",
          members: [
            { user_id: "user-uuid-1", display_name: "Me" },
            { user_id: "user-uuid-2", display_name: "Alice" },
          ],
          unread_count: 0,
        },
      ],
    });
    render(<ThreadList {...BASE_PROPS} />);
    // Label should be the OTHER member's display name
    expect(screen.getByRole("button", { name: /alice/i })).toBeInTheDocument();
  });

  it("renders group thread with thread name as label", () => {
    setup({
      data: [
        {
          id: "t2",
          thread_type: "group",
          name: "Care Team",
          members: [],
          unread_count: 0,
        },
      ],
    });
    render(<ThreadList {...BASE_PROPS} />);
    expect(
      screen.getByRole("button", { name: /care team/i }),
    ).toBeInTheDocument();
  });

  it("shows unread badge when unread_count > 0", () => {
    setup({
      data: [
        {
          id: "t3",
          thread_type: "dm",
          members: [
            { user_id: "user-uuid-1", display_name: "Me" },
            { user_id: "user-uuid-3", display_name: "Bob" },
          ],
          unread_count: 5,
        },
      ],
    });
    render(<ThreadList {...BASE_PROPS} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("does not show unread badge when unread_count is 0", () => {
    setup({
      data: [
        {
          id: "t4",
          thread_type: "dm",
          members: [
            { user_id: "user-uuid-1", display_name: "Me" },
            { user_id: "user-uuid-4", display_name: "Carol" },
          ],
          unread_count: 0,
        },
      ],
    });
    render(<ThreadList {...BASE_PROPS} />);
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows '99+' badge when unread_count > 99", () => {
    setup({
      data: [
        {
          id: "t5",
          thread_type: "dm",
          members: [
            { user_id: "user-uuid-1", display_name: "Me" },
            { user_id: "user-uuid-5", display_name: "Dave" },
          ],
          unread_count: 150,
        },
      ],
    });
    render(<ThreadList {...BASE_PROPS} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("navigates to ?thread=ID on thread click", () => {
    setup({
      data: [
        {
          id: "thread-nav-id",
          thread_type: "group",
          name: "Nav Group",
          members: [],
          unread_count: 0,
        },
      ],
    });
    render(<ThreadList {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole("button", { name: /nav group/i }));
    expect(mockPush).toHaveBeenCalledWith("/messages?thread=thread-nav-id");
  });

  it("renders 'No organisation found.' when orgId is null", () => {
    setup({ data: [] });
    render(<ThreadList orgId={null} userId="user-uuid-1" />);
    expect(screen.getByText(/no organisation found/i)).toBeInTheDocument();
  });

  it("renders last_message_body preview when present", () => {
    setup({
      data: [
        {
          id: "t6",
          thread_type: "group",
          name: "Preview Group",
          members: [],
          unread_count: 0,
          last_message_body: "See you tomorrow",
        },
      ],
    });
    render(<ThreadList {...BASE_PROPS} />);
    expect(screen.getByText("See you tomorrow")).toBeInTheDocument();
  });

  it("renders multiple threads", () => {
    setup({
      data: [
        {
          id: "t7",
          thread_type: "group",
          name: "Group A",
          members: [],
          unread_count: 0,
        },
        {
          id: "t8",
          thread_type: "group",
          name: "Group B",
          members: [],
          unread_count: 2,
        },
      ],
    });
    render(<ThreadList {...BASE_PROPS} />);
    expect(
      screen.getByRole("button", { name: /group a/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /group b/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
