import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LikesDislikesList } from "../LikesDislikesList";

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
    expect(within(likesList).getAllByRole("listitem")).toHaveLength(likes.length);
    expect(within(likesList).getByText("Coffee black")).toBeInTheDocument();
  });

  it("renders one li per dislike", () => {
    render(<LikesDislikesList likes={likes} dislikes={dislikes} />);
    const dislikesList = screen.getByRole("list", { name: "DISLIKES" });
    expect(within(dislikesList).getAllByRole("listitem")).toHaveLength(dislikes.length);
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

  it("uses ul semantic markup — one for likes, one for dislikes", () => {
    const { container } = render(
      <LikesDislikesList likes={likes} dislikes={dislikes} />,
    );
    const lists = container.querySelectorAll("ul");
    expect(lists).toHaveLength(2);
  });
});
