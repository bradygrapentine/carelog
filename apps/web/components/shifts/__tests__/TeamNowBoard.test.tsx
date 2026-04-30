import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TeamNowBoard } from "../TeamNowBoard";

const members = [
  { id: "anna", name: "Anna", status: "on" as const, detail: "8a–2p" },
  { id: "sarah", name: "Sarah", status: "next" as const, detail: "2p–6p" },
  { id: "david", name: "David", status: "later" as const },
  { id: "maria", name: "Maria", status: "off" as const },
  { id: "you", name: "You", status: "on" as const, detail: "shadowing" },
];

describe("<TeamNowBoard />", () => {
  it("renders all four groups in fixed order", () => {
    render(<TeamNowBoard members={members} />);
    for (const key of ["on", "next", "later", "off"] as const) {
      expect(screen.getByTestId(`group-${key}`)).toBeInTheDocument();
    }
  });

  it("groups members by status", () => {
    render(<TeamNowBoard members={members} />);
    const on = screen.getByTestId("group-on");
    expect(within(on).getByText("Anna")).toBeInTheDocument();
    expect(within(on).getByText("You")).toBeInTheDocument();
    expect(within(on).queryByText("Maria")).toBeNull();
    expect(
      within(screen.getByTestId("group-off")).getByText("Maria"),
    ).toBeInTheDocument();
  });

  it("shows the per-member detail when provided", () => {
    render(<TeamNowBoard members={members} />);
    expect(screen.getByText("8a–2p")).toBeInTheDocument();
    expect(screen.getByText("shadowing")).toBeInTheDocument();
  });

  it("shows an empty placeholder for groups with no members", () => {
    render(
      <TeamNowBoard members={members.filter((m) => m.status !== "later")} />,
    );
    expect(screen.getByTestId("group-later-empty")).toHaveTextContent(
      /nobody/i,
    );
  });

  it("renders deterministically with zero members", () => {
    render(<TeamNowBoard members={[]} />);
    for (const key of ["on", "next", "later", "off"] as const) {
      expect(screen.getByTestId(`group-${key}-empty`)).toBeInTheDocument();
    }
  });

  it("uses an h3 section heading", () => {
    render(<TeamNowBoard members={members} />);
    expect(
      screen.getByRole("heading", { name: /care team — right now/i, level: 3 }),
    ).toBeInTheDocument();
  });
});
