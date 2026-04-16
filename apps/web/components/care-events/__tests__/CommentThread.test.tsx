import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ careEvents: { comments: { list: { cancel: vi.fn(), setData: vi.fn() } } } }),
    careEvents: {
      comments: {
        list: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
        add: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }) },
        edit: { useMutation: () => ({ mutate: vi.fn() }) },
        remove: { useMutation: () => ({ mutate: vi.fn() }) },
      },
    },
  },
}));
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    channel: () => ({ on: function() { return this; }, subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
}));

import { CommentThread } from "../CommentThread";

describe("CommentThread", () => {
  it("starts collapsed with Add a comment button", () => {
    render(<CommentThread careEventId="e1" currentUserId="u1" />);
    expect(screen.getByRole("button", { name: /add a comment/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("expands when toggle clicked", () => {
    render(<CommentThread careEventId="e1" currentUserId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /add a comment/i }));
    expect(screen.getByRole("button", { name: /add a comment/i })).toHaveAttribute("aria-expanded", "true");
  });
});
