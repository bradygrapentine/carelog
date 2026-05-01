import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShiftTeamList } from "../ShiftTeamList";
import type { ShiftTeamMember } from "../ShiftTeamList";

const members: ShiftTeamMember[] = [
  {
    id: "m1",
    name: "Alice",
    role: "Day shift",
    shiftLabel: "8a–4p Mon/Wed/Fri",
    phone: "+15551234567",
    initials: "AL",
  },
  {
    id: "m2",
    name: "Bob",
    role: "Evenings",
  },
];

describe("<ShiftTeamList />", () => {
  it("renders one li per member", () => {
    render(<ShiftTeamList members={members} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });

  it("renders name and role", () => {
    render(<ShiftTeamList members={members} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Day shift")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Evenings")).toBeInTheDocument();
  });

  it("when shiftLabel is provided, renders it", () => {
    render(<ShiftTeamList members={members} />);
    expect(screen.getByText("8a–4p Mon/Wed/Fri")).toBeInTheDocument();
  });

  it("when phone is provided, renders a tel: link with descriptive aria-label", () => {
    render(<ShiftTeamList members={members} />);
    const link = screen.getByRole("link", { name: /call Alice/i });
    expect(link).toHaveAttribute("href", "tel:+15551234567");
  });

  it("when initials are absent, the User icon renders", () => {
    render(<ShiftTeamList members={[members[1]]} />);
    // User icon renders as svg with aria-hidden
    const icons = document.querySelectorAll("svg[aria-hidden]");
    expect(icons.length).toBeGreaterThan(0);
  });

  it("empty members shows the fallback", () => {
    render(<ShiftTeamList members={[]} />);
    expect(screen.getByText(/No team members/i)).toBeInTheDocument();
  });
});
