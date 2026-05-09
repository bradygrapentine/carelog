import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { PatternsStrip } from "../PatternsStrip";
import { trpc } from "@/lib/trpc";
import type { Pattern } from "@/lib/detectPattern";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    briefs: {
      patterns: { useQuery: vi.fn() },
    },
  },
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";
const PROPS = { recipientId: REC_ID, orgId: ORG_ID };

const MED: Pattern = {
  eyebrow: "PATTERN · 7-day",
  headline: "Medication misses are rising",
  detail: "3 missed doses this week vs 1 the week before — a 200% increase.",
  trend: "up",
};
const SLEEP: Pattern = {
  eyebrow: "PATTERN · 7-day",
  headline: "Sleep dipped this week",
  detail:
    "Average sleep this week was 5.5 h, down from 7.2 h the previous week — a drop of 1.7 h.",
  trend: "down",
};
const MOOD: Pattern = {
  eyebrow: "PATTERN · 7-day",
  headline: "Difficult days are clustering",
  detail: "4 difficult days this week, compared to none the week before.",
  trend: "up",
};

function setQueryData(data: Pattern[]) {
  vi.mocked(trpc.briefs.patterns.useQuery).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
  } as any);
}

function mockMatchMedia(prefersReducedMotion: boolean) {
  const mql = {
    matches: prefersReducedMotion,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));
  return mql;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PatternsStrip — empty state", () => {
  it("renders nothing when no patterns fired", () => {
    setQueryData([]);
    const { container } = render(<PatternsStrip {...PROPS} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the query is loading (data undefined)", () => {
    vi.mocked(trpc.briefs.patterns.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any);
    const { container } = render(<PatternsStrip {...PROPS} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PatternsStrip — rendering with real patterns", () => {
  beforeEach(() => setQueryData([MED, SLEEP, MOOD]));

  it("renders the section heading", () => {
    render(<PatternsStrip {...PROPS} />);
    expect(
      screen.getByRole("heading", { name: /PATTERNS WE'VE NOTICED/i }),
    ).toBeInTheDocument();
  });

  it("renders one card per pattern", () => {
    render(<PatternsStrip {...PROPS} />);
    expect(screen.getAllByTestId("pattern-card")).toHaveLength(3);
  });

  it("renders headline + detail for each pattern", () => {
    render(<PatternsStrip {...PROPS} />);
    expect(screen.getByText(MED.headline)).toBeInTheDocument();
    expect(screen.getByText(MED.detail)).toBeInTheDocument();
    expect(screen.getByText(SLEEP.headline)).toBeInTheDocument();
    expect(screen.getByText(MOOD.headline)).toBeInTheDocument();
  });

  it("preserves priority order from the query", () => {
    render(<PatternsStrip {...PROPS} />);
    const cards = screen.getAllByTestId("pattern-card");
    expect(cards[0].dataset.patternHeadline).toBe(MED.headline);
    expect(cards[1].dataset.patternHeadline).toBe(SLEEP.headline);
    expect(cards[2].dataset.patternHeadline).toBe(MOOD.headline);
  });

  it("renders the (early experiment) disclaimer", () => {
    render(<PatternsStrip {...PROPS} />);
    expect(screen.getByText("(early experiment)")).toBeInTheDocument();
  });
});

describe("PatternsStrip — single-pattern path", () => {
  it("renders just one card when only the med-miss pattern fired", () => {
    setQueryData([MED]);
    render(<PatternsStrip {...PROPS} />);
    expect(screen.getAllByTestId("pattern-card")).toHaveLength(1);
  });
});

describe("PatternsStrip — interaction", () => {
  beforeEach(() => setQueryData([MED, SLEEP, MOOD]));

  it("renders 'View entries →' button per card", () => {
    render(<PatternsStrip {...PROPS} />);
    expect(
      screen.getAllByRole("button", { name: /View entries/i }),
    ).toHaveLength(3);
  });

  it("routes to the journal with a medication filter for the med-miss card", () => {
    render(<PatternsStrip {...PROPS} />);
    const buttons = screen.getAllByRole("button", { name: /View entries/i });
    fireEvent.click(buttons[0]);
    expect(mockPush).toHaveBeenCalledWith(
      `/journal/${REC_ID}?filter=medication`,
    );
  });

  it("routes to a sleep filter for the sleep-dip card", () => {
    render(<PatternsStrip {...PROPS} />);
    const buttons = screen.getAllByRole("button", { name: /View entries/i });
    fireEvent.click(buttons[1]);
    expect(mockPush).toHaveBeenCalledWith(`/journal/${REC_ID}?filter=sleep`);
  });

  it("routes to a mood filter for the mood-cluster card", () => {
    render(<PatternsStrip {...PROPS} />);
    const buttons = screen.getAllByRole("button", { name: /View entries/i });
    fireEvent.click(buttons[2]);
    expect(mockPush).toHaveBeenCalledWith(`/journal/${REC_ID}?filter=mood`);
  });
});

describe("PatternsStrip — reduced motion", () => {
  beforeEach(() => setQueryData([MED]));

  it("scroll container reflects reduced-motion=false by default", () => {
    mockMatchMedia(false);
    render(<PatternsStrip {...PROPS} />);
    expect(
      screen.getByTestId("patterns-scroll-container").dataset.reducedMotion,
    ).toBe("false");
  });

  it("scroll container reflects reduced-motion=true when preferred", () => {
    mockMatchMedia(true);
    render(<PatternsStrip {...PROPS} />);
    expect(
      screen.getByTestId("patterns-scroll-container").dataset.reducedMotion,
    ).toBe("true");
  });
});

describe("PatternsStrip — accessibility", () => {
  it("has no axe violations with three patterns rendered", async () => {
    setQueryData([MED, SLEEP, MOOD]);
    const { container } = render(<PatternsStrip {...PROPS} />);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});
