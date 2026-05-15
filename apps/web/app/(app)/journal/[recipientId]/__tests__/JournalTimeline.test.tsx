import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { JournalTimeline } from "../JournalTimeline";
import { toast } from "sonner";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Match a button whose accessible name STARTS WITH the given prefix. The Flag /
// Unflag buttons now embed the entry timestamp in their aria-label for context
// (H-2 / a11y), so the literal-string assertion no longer works.
const byNamePrefix = (prefix: string) =>
  new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
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
    actor_id: string;
    payload: { text?: string; mood?: string };
  }> = {},
) {
  return {
    id: "evt-1",
    event_type: "journal",
    entry_kind: "human",
    occurred_at: new Date().toISOString(),
    flagged: false,
    actor_id: "u1",
    payload: { text: "Dad had a calm day." },
    ...overrides,
  };
}

const TEST_MEMBERS = [{ user_id: "u1", display_name: "Test User" }];

describe("JournalTimeline — pagination sentinel", () => {
  it("does NOT render the load-more sentinel when hasMore is false", () => {
    render(
      <JournalTimeline
        events={[makeEvent({ id: "p1" })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
        onLoadMore={vi.fn()}
        hasMore={false}
      />,
    );
    expect(
      screen.queryByTestId("journal-load-more-sentinel"),
    ).not.toBeInTheDocument();
  });

  it("does NOT render the sentinel when onLoadMore is not provided", () => {
    render(
      <JournalTimeline
        events={[makeEvent({ id: "p2" })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
        hasMore={true}
      />,
    );
    expect(
      screen.queryByTestId("journal-load-more-sentinel"),
    ).not.toBeInTheDocument();
  });

  it("renders sentinel + Load older button when hasMore + onLoadMore are present", () => {
    const onLoadMore = vi.fn();
    render(
      <JournalTimeline
        events={[makeEvent({ id: "p3" })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
        onLoadMore={onLoadMore}
        hasMore={true}
      />,
    );
    expect(
      screen.getByTestId("journal-load-more-sentinel"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /load older entries/i }),
    );
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("disables the load-more button while loadingMore is true", () => {
    render(
      <JournalTimeline
        events={[makeEvent({ id: "p4" })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
        onLoadMore={vi.fn()}
        hasMore={true}
        loadingMore={true}
      />,
    );
    const btn = screen.getByRole("button", { name: /load older entries/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/loading/i);
  });
});

describe("JournalTimeline — empty state", () => {
  it("shows empty state when canFlag is true", () => {
    render(
      <JournalTimeline
        events={[]}
        currentUserId="u1"
        canFlag={true}
        recipientId="r1"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
      />,
    );
    expect(screen.getByText("Quiet day in the journal")).toBeInTheDocument();
  });

  it("shows empty state when canFlag is false", () => {
    render(
      <JournalTimeline
        events={[]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
      />,
    );
    expect(screen.getByText("Quiet day in the journal")).toBeInTheDocument();
  });
});

describe("JournalTimeline — human journal entries", () => {
  it("journal entry card links to the detail page", () => {
    render(
      <JournalTimeline
        events={[makeEvent({ id: "evt-nav" })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
      />,
    );
    // C-2: card is a real <Link> (anchor) for keyboard accessibility.
    const link = screen.getByRole("link", {
      name: /open journal entry from/i,
    });
    expect(link).toHaveAttribute("href", "/journal/r1/entry/evt-nav");
  });

  it("renders the entry text", () => {
    render(
      <JournalTimeline
        events={[makeEvent()]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
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
        members={TEST_MEMBERS}
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
        members={TEST_MEMBERS}
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
        members={TEST_MEMBERS}
      />,
    );
    expect(
      screen.getByRole("button", { name: byNamePrefix("Flag entry from") }),
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
        members={TEST_MEMBERS}
      />,
    );
    expect(
      screen.queryByRole("button", { name: byNamePrefix("Flag entry from") }),
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
        members={TEST_MEMBERS}
      />,
    );
    expect(screen.getByText("Flagged for doctor")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: byNamePrefix("Unflag entry from") }),
    ).toBeInTheDocument();
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
        members={TEST_MEMBERS}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: byNamePrefix("Flag entry from") }),
    );
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
        members={TEST_MEMBERS}
      />,
    );
    // H-3: reactions use aria-label, not title (better screen-reader support).
    expect(screen.getByRole("button", { name: "Heart" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Thinking of you" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Strong" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Grateful" }),
    ).toBeInTheDocument();
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
        members={TEST_MEMBERS}
      />,
    );
    // System events show "<event_type> logged" text, not a full card
    expect(screen.getByText("medication logged")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Heart" }),
    ).not.toBeInTheDocument();
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
        members={TEST_MEMBERS}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Flag for doctor" }),
    ).not.toBeInTheDocument();
  });
});

describe("JournalTimeline — abort on rapid recipient switch", () => {
  it("first fetch does not update state after abort (rapid recipientId change)", async () => {
    // Controlled fetch: first call resolves after a delay; second is instant
    let resolveFirst!: (v: unknown) => void;
    const firstFetchPromise = new Promise((res) => {
      resolveFirst = res;
    });

    let callCount = 0;
    const controlledFetch = vi
      .fn()
      .mockImplementation((_url: string, opts?: { signal?: AbortSignal }) => {
        callCount++;
        if (callCount === 1) {
          // Slow first fetch — will be aborted
          return new Promise((_res, rej) => {
            opts?.signal?.addEventListener("abort", () =>
              rej(
                Object.assign(new Error("AbortError"), { name: "AbortError" }),
              ),
            );
            firstFetchPromise.then(_res);
          });
        }
        // Instant second fetch
        return Promise.resolve({
          json: () =>
            Promise.resolve({ counts: { heart: 2 }, myReaction: null }),
        });
      });

    vi.stubGlobal("fetch", controlledFetch);

    const { rerender } = render(
      <JournalTimeline
        events={[makeEvent({ id: "evt-a" })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
      />,
    );

    // Switch recipient before first fetch resolves
    rerender(
      <JournalTimeline
        events={[makeEvent({ id: "evt-b" })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r2"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
      />,
    );

    // Resolve the first (now-aborted) fetch — state should NOT reflect heart:2
    await act(async () => {
      resolveFirst({
        json: () =>
          Promise.resolve({ counts: { heart: 99 }, myReaction: "heart" }),
      });
      // Let microtasks drain
      await Promise.resolve();
    });

    // heart:99 from the stale first fetch must not appear
    expect(screen.queryByText("99")).not.toBeInTheDocument();
  });
});

describe("JournalTimeline — toast on rollback", () => {
  it("calls toast.error when reaction toggle network request fails", async () => {
    const toastError = vi.mocked(toast.error);
    toastError.mockClear();

    // Initial fetch resolves normally; toggle fetch rejects
    let toggleCallCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if ((url as string).includes("reactions") && !String(url).includes("?")) {
        // Mutation endpoint — fail after first (initial GET)
        toggleCallCount++;
        if (toggleCallCount > 0) {
          return Promise.reject(new Error("Network error"));
        }
      }
      return Promise.resolve({
        json: () => Promise.resolve({ counts: {}, myReaction: null }),
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <JournalTimeline
        events={[makeEvent({ id: "evt-toast" })]}
        currentUserId="u1"
        canFlag={false}
        recipientId="r1"
        onFlag={vi.fn()}
        members={TEST_MEMBERS}
      />,
    );

    // Wait for initial fetch to complete
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Trigger a reaction toggle (POST)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Heart" }));
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "That didn't save. Try again.",
        expect.objectContaining({
          action: expect.objectContaining({ label: "Try again" }),
        }),
      );
    });
  });
});
