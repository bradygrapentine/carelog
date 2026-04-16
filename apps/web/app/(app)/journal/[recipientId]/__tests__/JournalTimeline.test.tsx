import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JournalTimeline } from "../JournalTimeline";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/components/care-events/CommentThread", () => ({
  CommentThread: () => null,
}));
vi.mock("@/components/medications/MedicationChipBar", () => ({
  MedicationChipBar: () => null,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    medications: {
      getEventIdsForMedication: {
        useQuery: vi.fn().mockReturnValue({ data: undefined }),
      },
    },
  },
}));

const STUB_FETCH = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ counts: {}, myReaction: null }),
});

beforeEach(() => {
  vi.stubGlobal("fetch", STUB_FETCH);
  mockPush.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  STUB_FETCH.mockClear();
});

function makeEvent(
  overrides: Partial<{
    id: string;
    event_type: string;
    entry_kind: string;
    occurred_at: string;
    flagged: boolean;
    payload: { text?: string; mood?: string };
  }> = {},
) {
  return {
    id: "evt-1",
    event_type: "journal",
    entry_kind: "human",
    occurred_at: new Date().toISOString(),
    flagged: false,
    payload: { text: "Dad had a calm day." },
    ...overrides,
  };
}

describe("JournalTimeline — empty state", () => {
  it("shows empty state when canFlag is true", () => {
    render(
      <JournalTimeline
        events={[]}
        currentUserId="u1"
        canFlag={true}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    expect(screen.getByText("No journal entries yet")).toBeInTheDocument();
  });

  it("shows empty state when canFlag is false", () => {
    render(
      <JournalTimeline
        events={[]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    expect(screen.getByText("No journal entries yet")).toBeInTheDocument();
  });
});

describe("JournalTimeline — human journal entries", () => {
  it("navigates to detail page when a journal card is clicked", () => {
    render(
      <JournalTimeline
        events={[makeEvent({ id: "evt-nav" })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    const card = screen.getByTestId("journal-entry");
    fireEvent.click(card);
    expect(mockPush).toHaveBeenCalledWith("/journal/r1/entry/evt-nav");
  });

  it("renders the entry text", () => {
    render(
      <JournalTimeline
        events={[makeEvent()]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    expect(screen.getByText("Dad had a calm day.")).toBeInTheDocument();
  });

  it("renders mood badge when mood is set", () => {
    render(
      <JournalTimeline
        events={[makeEvent({ payload: { text: "OK", mood: "good" } })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    expect(screen.getByText("good")).toBeInTheDocument();
  });

  it("omits mood badge when mood is absent", () => {
    render(
      <JournalTimeline
        events={[makeEvent({ payload: { text: "Note" } })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    expect(screen.queryByText("good")).not.toBeInTheDocument();
  });

  it('shows "Flag for doctor" button when canFlag is true', () => {
    render(
      <JournalTimeline
        events={[makeEvent()]}
        currentUserId="u1"
        canFlag={true}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Flag for doctor" }),
    ).toBeInTheDocument();
  });

  it("hides flag button when canFlag is false", () => {
    render(
      <JournalTimeline
        events={[makeEvent()]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Flag for doctor" }),
    ).not.toBeInTheDocument();
  });

  it('shows "Flagged for doctor" badge and Unflag button when entry is flagged', () => {
    render(
      <JournalTimeline
        events={[makeEvent({ flagged: true })]}
        currentUserId="u1"
        canFlag={true}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    expect(screen.getByText("Flagged for doctor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unflag" })).toBeInTheDocument();
  });

  it("calls onFlag with eventId and new flagged value when flag button is clicked", () => {
    const onFlag = vi.fn();
    render(
      <JournalTimeline
        events={[makeEvent({ id: "evt-1", flagged: false })]}
        currentUserId="u1"
        canFlag={true}
        recipientId="r1"
        onFlag={onFlag}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Flag for doctor" }));
    expect(onFlag).toHaveBeenCalledWith("evt-1", true);
  });

  it("renders four reaction buttons", () => {
    render(
      <JournalTimeline
        events={[makeEvent()]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    expect(screen.getByTitle("Heart")).toBeInTheDocument();
    expect(screen.getByTitle("Thinking of you")).toBeInTheDocument();
    expect(screen.getByTitle("Strong")).toBeInTheDocument();
    expect(screen.getByTitle("Grateful")).toBeInTheDocument();
  });
});

describe("JournalTimeline — system events", () => {
  it("renders system events as compact display, not as journal card", () => {
    const sysEvent = makeEvent({
      entry_kind: "system",
      event_type: "medication",
      payload: {},
    });
    render(
      <JournalTimeline
        events={[sysEvent]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    // System events show "<event_type> logged" text, not a full card
    expect(screen.getByText("medication logged")).toBeInTheDocument();
    expect(screen.queryByTitle("Heart")).not.toBeInTheDocument();
  });

  it("does not show flag button for system events", () => {
    const sysEvent = makeEvent({
      entry_kind: "system",
      event_type: "shift",
      payload: {},
    });
    render(
      <JournalTimeline
        events={[sysEvent]}
        currentUserId="u1"
        canFlag={true}
        recipientId="r1"
        onFlag={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Flag for doctor" }),
    ).not.toBeInTheDocument();
  });
});
