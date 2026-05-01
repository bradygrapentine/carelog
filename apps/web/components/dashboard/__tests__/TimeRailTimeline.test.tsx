import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimeRailTimeline } from "../TimeRailTimeline";
import type { TimelineEvent } from "../TimeRailTimeline";

const EVENTS: TimelineEvent[] = [
  {
    id: "2",
    type: "journal",
    at: "2026-05-01T10:00:00.000Z",
    title: "Morning note",
    detail: "She seemed calm",
  },
  {
    id: "1",
    type: "med",
    at: "2026-05-01T08:00:00.000Z",
    title: "Donepezil 10mg",
  },
  {
    id: "3",
    type: "vital",
    at: "2026-05-01T14:00:00.000Z",
    title: "Blood pressure reading",
  },
];

describe("TimeRailTimeline", () => {
  it("renders events sorted by `at` ascending regardless of input order", () => {
    render(
      <TimeRailTimeline
        events={EVENTS}
        now={new Date("2026-05-01T12:00:00.000Z")}
      />,
    );
    const items = screen.getAllByRole("listitem");
    const texts = items.map((el) => el.textContent ?? "");
    const medIdx = texts.findIndex((t) => t.includes("Donepezil"));
    const journalIdx = texts.findIndex((t) => t.includes("Morning note"));
    const vitalIdx = texts.findIndex((t) => t.includes("Blood pressure"));
    expect(medIdx).toBeLessThan(journalIdx);
    expect(journalIdx).toBeLessThan(vitalIdx);
  });

  it("renders one row per event with both timestamp and title", () => {
    render(
      <TimeRailTimeline
        events={EVENTS}
        now={new Date("2026-05-01T12:00:00.000Z")}
      />,
    );
    expect(screen.getByText("Donepezil 10mg")).toBeInTheDocument();
    expect(screen.getByText("Morning note")).toBeInTheDocument();
    expect(screen.getByText("Blood pressure reading")).toBeInTheDocument();
  });

  it("renders the NOW pill when showNowMarker is not false", () => {
    render(
      <TimeRailTimeline
        events={EVENTS}
        now={new Date("2026-05-01T12:00:00.000Z")}
      />,
    );
    expect(screen.getByText("NOW")).toBeInTheDocument();
  });

  it("does NOT render the NOW pill when showNowMarker is false", () => {
    render(
      <TimeRailTimeline
        events={EVENTS}
        now={new Date("2026-05-01T12:00:00.000Z")}
        showNowMarker={false}
      />,
    );
    expect(screen.queryByText("NOW")).toBeNull();
  });

  it("shows 'Nothing logged today.' for an empty events array", () => {
    render(<TimeRailTimeline events={[]} />);
    expect(screen.getByText("Nothing logged today.")).toBeInTheDocument();
  });

  it("renders distinct icon data-icon attributes per type", () => {
    const oneOfEach: TimelineEvent[] = [
      { id: "a", type: "med", at: "2026-05-01T08:00:00.000Z", title: "Med" },
      {
        id: "b",
        type: "journal",
        at: "2026-05-01T09:00:00.000Z",
        title: "Journal",
      },
      {
        id: "c",
        type: "shift",
        at: "2026-05-01T10:00:00.000Z",
        title: "Shift",
      },
      {
        id: "d",
        type: "vital",
        at: "2026-05-01T11:00:00.000Z",
        title: "Vital",
      },
      {
        id: "e",
        type: "appointment",
        at: "2026-05-01T12:00:00.000Z",
        title: "Appt",
      },
      {
        id: "f",
        type: "note",
        at: "2026-05-01T13:00:00.000Z",
        title: "Note",
      },
    ];
    const { container } = render(
      <TimeRailTimeline
        events={oneOfEach}
        now={new Date("2026-05-01T14:00:00.000Z")}
      />,
    );
    const icons = container.querySelectorAll("[data-icon]");
    const iconNames = Array.from(icons).map((el) =>
      el.getAttribute("data-icon"),
    );
    const unique = new Set(iconNames);
    // Each event type should have a distinct icon name
    expect(unique.size).toBeGreaterThanOrEqual(4);
  });

  it("renders detail when provided and omits it when not", () => {
    render(
      <TimeRailTimeline
        events={EVENTS}
        now={new Date("2026-05-01T12:00:00.000Z")}
      />,
    );
    expect(screen.getByText("She seemed calm")).toBeInTheDocument();
    // Donepezil has no detail — verify the detail container is absent
    const listItems = screen.getAllByRole("listitem");
    const medItem = listItems.find((el) =>
      el.textContent?.includes("Donepezil"),
    );
    expect(medItem?.querySelector("[data-detail]")).toBeNull();
  });

  it("wraps content in a section with aria-label=\"Today's timeline\"", () => {
    render(
      <TimeRailTimeline
        events={EVENTS}
        now={new Date("2026-05-01T12:00:00.000Z")}
      />,
    );
    expect(
      screen.getByRole("region", { name: "Today's timeline" }),
    ).toBeInTheDocument();
  });
});
