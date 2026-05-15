import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NowBoard, bucketEvents } from "../NowBoard";
import { trpc } from "@/lib/trpc";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    careEvents: {
      timeline: { useQuery: vi.fn() },
    },
  },
}));

const REC_ID = "20000000-0000-0000-0000-000000000001";
const NOW = new Date("2026-04-30T12:00:00.000Z");

type Ev = {
  id: string;
  event_type: string;
  occurred_at: string;
  payload: Record<string, unknown> | null;
};

function ev(
  id: string,
  iso: string,
  payload: Record<string, unknown> | null = null,
  event_type = "journal",
): Ev {
  return { id, event_type, occurred_at: iso, payload };
}

function setEvents(events: Ev[] | undefined, isLoading = false) {
  vi.mocked(trpc.careEvents.timeline.useQuery).mockReturnValue({
    data: events,
    isLoading,
  } as ReturnType<typeof trpc.careEvents.timeline.useQuery>);
}

describe("bucketEvents (pure)", () => {
  it("splits events into past, now (±30min), and upNext", () => {
    const events: Ev[] = [
      ev("a", "2026-04-30T08:00:00.000Z"), // past
      ev("b", "2026-04-30T11:50:00.000Z"), // now
      ev("c", "2026-04-30T12:10:00.000Z"), // now
      ev("d", "2026-04-30T15:00:00.000Z"), // up next
    ];
    const out = bucketEvents(events, NOW);
    expect(out.past.map((e) => e.id)).toEqual(["a"]);
    expect(out.now.map((e) => e.id)).toEqual(["b", "c"]);
    expect(out.upNext.map((e) => e.id)).toEqual(["d"]);
  });

  it("orders past most-recent first and upNext soonest first", () => {
    const events: Ev[] = [
      ev("p1", "2026-04-30T07:00:00.000Z"),
      ev("p2", "2026-04-30T09:00:00.000Z"),
      ev("u1", "2026-04-30T18:00:00.000Z"),
      ev("u2", "2026-04-30T14:00:00.000Z"),
    ];
    const out = bucketEvents(events, NOW);
    expect(out.past.map((e) => e.id)).toEqual(["p2", "p1"]);
    expect(out.upNext.map((e) => e.id)).toEqual(["u2", "u1"]);
  });
});

describe("NowBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an empty state when there are no events", () => {
    setEvents([]);
    render(<NowBoard recipientId={REC_ID} now={NOW} />);
    expect(
      screen.getByText(
        /Nothing logged yet today\. The first note from the journal/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders only Past when all events are past", () => {
    setEvents([
      ev("a", "2026-04-30T07:00:00.000Z"),
      ev("b", "2026-04-30T09:00:00.000Z"),
    ]);
    render(<NowBoard recipientId={REC_ID} now={NOW} />);
    expect(screen.getByText("Past")).toBeInTheDocument();
    expect(screen.queryByText("Up next")).not.toBeInTheDocument();
    // Without an Up next group, no NOW marker is rendered.
    expect(
      document.querySelector('[role="separator"]'),
    ).not.toBeInTheDocument();
  });

  it("renders the NOW marker between Now and Up Next", () => {
    setEvents([
      ev("p", "2026-04-30T07:00:00.000Z"),
      ev("n", "2026-04-30T11:55:00.000Z"),
      ev("u", "2026-04-30T15:00:00.000Z"),
    ]);
    render(<NowBoard recipientId={REC_ID} now={NOW} />);
    expect(screen.getByText("Past")).toBeInTheDocument();
    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByText("Up next")).toBeInTheDocument();
    const sep = document.querySelector('[role="separator"]');
    expect(sep).toBeInTheDocument();
    expect(sep?.getAttribute("aria-label")).toMatch(/^NOW/);
  });

  it("renders only future events without past or now groups", () => {
    setEvents([
      ev("u1", "2026-04-30T14:00:00.000Z"),
      ev("u2", "2026-04-30T16:00:00.000Z"),
    ]);
    render(<NowBoard recipientId={REC_ID} now={NOW} />);
    expect(screen.queryByText("Past")).not.toBeInTheDocument();
    expect(screen.queryByText("Now")).not.toBeInTheDocument();
    expect(screen.getByText("Up next")).toBeInTheDocument();
  });

  it("applies a mood-coloured left border per known mood", () => {
    setEvents([
      ev("good", "2026-04-30T11:00:00.000Z", { mood: "good" }),
      ev("crisis", "2026-04-30T10:00:00.000Z", { mood: "crisis" }),
      ev("plain", "2026-04-30T09:00:00.000Z", { note: "no mood" }),
    ]);
    const { container } = render(<NowBoard recipientId={REC_ID} now={NOW} />);
    const items = container.querySelectorAll("li.rounded-md");
    // Three event cards (sorted past-most-recent-first: 11, 10, 09).
    expect(items.length).toBe(3);
    const classNames = Array.from(items).map((i) => i.className);
    expect(classNames[0]).toMatch(/border-l-\[var\(--color-mood-good\)\]/);
    expect(classNames[1]).toMatch(/border-l-\[var\(--color-mood-crisis\)\]/);
    // No mood → neutral border token.
    expect(classNames[2]).toMatch(/border-l-\[var\(--color-border\)\]/);
  });

  it("exposes the timeline as a labelled list for screen readers", () => {
    setEvents([ev("a", "2026-04-30T07:00:00.000Z")]);
    render(<NowBoard recipientId={REC_ID} now={NOW} />);
    expect(
      screen.getByRole("list", { name: /Now Board timeline/i }),
    ).toBeInTheDocument();
  });

  it("renders a guidance card when no recipient is selected", () => {
    setEvents(undefined);
    render(<NowBoard recipientId={undefined} now={NOW} />);
    expect(screen.getByText(/No recipient selected/i)).toBeInTheDocument();
  });
});
