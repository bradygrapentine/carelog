import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

// Capture mutation option callbacks so tests can invoke onError
let addMutationOpts: { onError?: (e: Error) => void } = {};
let editMutationOpts: { onError?: (e: Error) => void } = {};
let removeMutationOpts: { onError?: (e: Error) => void; onMutate?: unknown; onSettled?: unknown } = {};

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      careEvents: {
        comments: {
          list: { cancel: vi.fn(), setData: vi.fn() },
        },
      },
    }),
    careEvents: {
      comments: {
        list: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
        add: {
          useMutation: (opts: { onError?: (e: Error) => void }) => {
            addMutationOpts = opts ?? {};
            return {
              mutate: vi.fn(),
              mutateAsync: vi.fn().mockResolvedValue({}),
              isPending: false,
            };
          },
        },
        edit: {
          useMutation: (opts: { onError?: (e: Error) => void }) => {
            editMutationOpts = opts ?? {};
            return { mutate: vi.fn() };
          },
        },
        remove: {
          useMutation: (opts: { onError?: (e: Error) => void; onMutate?: unknown; onSettled?: unknown }) => {
            removeMutationOpts = opts ?? {};
            return { mutate: vi.fn() };
          },
        },
      },
    },
  },
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    channel: () => ({
      on: function () {
        return this;
      },
      subscribe: () => ({}),
    }),
    removeChannel: () => {},
  }),
}));

import { CommentThread } from "../CommentThread";

beforeEach(() => {
  vi.clearAllMocks();
  addMutationOpts = {};
  editMutationOpts = {};
  removeMutationOpts = {};
});

describe("CommentThread", () => {
  it("starts collapsed with Add a comment button", () => {
    render(<CommentThread careEventId="e1" currentUserId="u1" />);
    expect(
      screen.getByRole("button", { name: /add a comment/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("expands when toggle clicked", () => {
    render(<CommentThread careEventId="e1" currentUserId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: /add a comment/i }));
    expect(
      screen.getByRole("button", { name: /add a comment/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("shows toast.error when add mutation fails", async () => {
    render(<CommentThread careEventId="e1" currentUserId="u1" />);
    await waitFor(() => {
      expect(addMutationOpts.onError).toBeDefined();
    });
    addMutationOpts.onError!(new Error("network"));
    expect(toast.error).toHaveBeenCalledWith(
      "That comment didn't post. Try again.",
    );
  });

  it("shows toast.error when edit mutation fails", async () => {
    render(<CommentThread careEventId="e1" currentUserId="u1" />);
    await waitFor(() => {
      expect(editMutationOpts.onError).toBeDefined();
    });
    editMutationOpts.onError!(new Error("network"));
    expect(toast.error).toHaveBeenCalledWith(
      "That edit didn't save.",
    );
  });

  it("shows toast.error when remove mutation fails", async () => {
    render(<CommentThread careEventId="e1" currentUserId="u1" />);
    await waitFor(() => {
      expect(removeMutationOpts.onError).toBeDefined();
    });
    removeMutationOpts.onError!(new Error("network"));
    expect(toast.error).toHaveBeenCalledWith(
      "That comment didn't delete.",
    );
  });
});
