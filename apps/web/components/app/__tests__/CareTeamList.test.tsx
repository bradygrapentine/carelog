import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CareTeamList } from "../CareTeamList";

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

describe("CareTeamList", () => {
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
    // Lucide User icon is rendered with data-testid="user-icon-fallback"
    expect(screen.getByTestId("user-icon-fallback")).toBeInTheDocument();
  });

  it("when members is empty, shows 'No team members yet.'", () => {
    render(<CareTeamList members={[]} />);
    expect(screen.getByText(/no team members yet/i)).toBeInTheDocument();
  });
});
