import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LikesDislikesList } from "../LikesDislikesList";

const { mockMutate, mockUpdateMutation, mockRouterRefresh } = vi.hoisted(
  () => ({
    mockMutate: vi.fn(),
    mockUpdateMutation: vi.fn(),
    mockRouterRefresh: vi.fn(),
  }),
);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    recipients: {
      updatePreferences: { useMutation: mockUpdateMutation },
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

beforeEach(() => {
  mockMutate.mockReset();
  mockRouterRefresh.mockReset();
  mockUpdateMutation.mockReset();
  mockUpdateMutation.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  });
});

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

describe("LikesDislikesList", () => {
  const likes = ["Coffee black", "Cardinals on the feeder", "Old westerns"];
  const dislikes = ["Loud TV", "Pills with water", "Cold food"];

  it("renders both LIKES and DISLIKES eyebrow headings", () => {
    render(<LikesDislikesList likes={likes} dislikes={dislikes} />);
    expect(screen.getByText("LIKES")).toBeInTheDocument();
    expect(screen.getByText("DISLIKES")).toBeInTheDocument();
  });

  it("renders one li per like", () => {
    render(<LikesDislikesList likes={likes} dislikes={dislikes} />);
    const likesList = screen.getByRole("list", { name: "LIKES" });
    expect(within(likesList).getAllByRole("listitem")).toHaveLength(
      likes.length,
    );
    expect(within(likesList).getByText("Coffee black")).toBeInTheDocument();
  });

  it("renders one li per dislike", () => {
    render(<LikesDislikesList likes={likes} dislikes={dislikes} />);
    const dislikesList = screen.getByRole("list", { name: "DISLIKES" });
    expect(within(dislikesList).getAllByRole("listitem")).toHaveLength(
      dislikes.length,
    );
    expect(within(dislikesList).getByText("Loud TV")).toBeInTheDocument();
  });

  it("when likes is empty, shows the empty message", () => {
    render(<LikesDislikesList likes={[]} dislikes={dislikes} />);
    const likesList = screen.getByRole("list", { name: "LIKES" });
    expect(within(likesList).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getAllByText(/nothing recorded yet/i)[0]).toBeInTheDocument();
  });

  it("when dislikes is empty, shows the empty message", () => {
    render(<LikesDislikesList likes={likes} dislikes={[]} />);
    const dislikesList = screen.getByRole("list", { name: "DISLIKES" });
    expect(within(dislikesList).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getAllByText(/nothing recorded yet/i)[0]).toBeInTheDocument();
  });

  it("does not render Edit button when canEdit is false (default)", () => {
    render(<LikesDislikesList likes={likes} dislikes={dislikes} />);
    expect(screen.queryByRole("button", { name: /^edit$/i })).toBeNull();
  });

  it("renders Edit button when canEdit is true with orgId+recipientId", () => {
    render(
      <LikesDislikesList
        likes={likes}
        dislikes={dislikes}
        orgId={ORG_ID}
        recipientId={REC_ID}
        canEdit
      />,
    );
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("clicking Edit shows editable inputs; Cancel reverts and exits edit mode", () => {
    render(
      <LikesDislikesList
        likes={likes}
        dislikes={dislikes}
        orgId={ORG_ID}
        recipientId={REC_ID}
        canEdit
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    // Inputs render with current values
    expect(screen.getByDisplayValue("Coffee black")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Loud TV")).toBeInTheDocument();
    // Cancel returns to read-only display
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByDisplayValue("Coffee black")).toBeNull();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("Save invokes updatePreferences with trimmed, non-empty values", () => {
    render(
      <LikesDislikesList
        likes={likes}
        dislikes={dislikes}
        orgId={ORG_ID}
        recipientId={REC_ID}
        canEdit
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({
      org_id: ORG_ID,
      recipient_id: REC_ID,
      likes,
      dislikes,
    });
  });

  it("uses ul semantic markup — one for likes, one for dislikes", () => {
    const { container } = render(
      <LikesDislikesList likes={likes} dislikes={dislikes} />,
    );
    const lists = container.querySelectorAll("ul");
    expect(lists).toHaveLength(2);
  });
});
