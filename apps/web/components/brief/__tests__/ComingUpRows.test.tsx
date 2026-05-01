import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComingUpRows } from "../ComingUpRows";

const events = [
  { id: "1", time: "9:00a", label: "Donepezil", detail: "after breakfast" },
  { id: "2", time: "11:00a", label: "PT visit" },
  { id: "3", time: "2:30p", label: "Calcium" },
];

describe("ComingUpRows", () => {
  it("renders one row per event", () => {
    const { container } = render(<ComingUpRows events={events} />);
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("renders the time and label for each event", () => {
    render(<ComingUpRows events={events} />);
    expect(screen.getByText("9:00a")).toBeInTheDocument();
    expect(screen.getByText("Donepezil")).toBeInTheDocument();
    expect(screen.getByText("PT visit")).toBeInTheDocument();
  });

  it("renders the detail when provided", () => {
    render(<ComingUpRows events={events} />);
    expect(screen.getByText("after breakfast")).toBeInTheDocument();
  });

  it("omits the detail node when not provided", () => {
    const { container } = render(
      <ComingUpRows events={[{ id: "x", time: "1p", label: "Lunch" }]} />,
    );
    const li = container.querySelector("li")!;
    // detail span lives inside the .ml-2 class scope; absence means no detail node
    expect(li.querySelector(".ml-2")).toBeNull();
  });

  it("renders an empty-state message when events is empty", () => {
    render(<ComingUpRows events={[]} />);
    expect(screen.getByText("Nothing scheduled.")).toBeInTheDocument();
  });

  it("uses a custom emptyLabel when provided", () => {
    render(<ComingUpRows events={[]} emptyLabel="No events today." />);
    expect(screen.getByText("No events today.")).toBeInTheDocument();
  });

  it("uses semantic ul/li markup", () => {
    const { container } = render(<ComingUpRows events={events} />);
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelectorAll("li").length).toBeGreaterThan(0);
  });

  it("merges a custom className onto the ul", () => {
    const { container } = render(
      <ComingUpRows events={events} className="mt-4" />,
    );
    const ul = container.querySelector("ul");
    expect(ul?.className).toContain("mt-4");
  });
});
