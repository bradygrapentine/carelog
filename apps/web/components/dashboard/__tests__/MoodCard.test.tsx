import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { MoodCard } from "../MoodCard";
import { trpc } from "@/lib/trpc";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

vi.mock("@/lib/trpc", () => ({
  trpc: {
    moodEntries: {
      sparkline: { useQuery: vi.fn() },
    },
  },
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

/** Build a bars array of length 13 with the given value (0..1). */
function makeBars(value: number): number[] {
  return Array.from({ length: 13 }, () => value);
}

const DATA_WITH_ENTRIES = {
  bars: makeBars(0.6),
  todayLabel: "Good",
  trendSummary:
    "Mood readings shown for the last 13 days — today's reading: Good.",
  hasData: true,
};

const DATA_EMPTY = {
  bars: makeBars(0),
  todayLabel: null,
  trendSummary: "No mood readings in the last 13 days.",
  hasData: false,
};

beforeEach(() => {
  vi.mocked(trpc.moodEntries.sparkline.useQuery).mockReturnValue({
    data: DATA_WITH_ENTRIES,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof trpc.moodEntries.sparkline.useQuery>);
});

// ── Sparkline (data state) ───────────────────────────────────────────────────

describe("MoodCard — sparkline (real data)", () => {
  it("renders exactly 13 bars", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const bars = screen.getAllByTestId("mood-bar");
    expect(bars).toHaveLength(13);
  });

  it("the last bar has data-today='true'", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const bars = screen.getAllByTestId("mood-bar");
    expect(bars[bars.length - 1]!.dataset.today).toBe("true");
  });

  it("the first 12 bars have data-today='false'", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const bars = screen.getAllByTestId("mood-bar");
    for (let i = 0; i < 12; i++) {
      expect(bars[i]!.dataset.today).toBe("false");
    }
  });

  it("today bar uses --color-primary", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const bars = screen.getAllByTestId("mood-bar");
    expect(bars[bars.length - 1]!.className).toContain(
      "bg-[var(--color-primary)]",
    );
  });

  it("earlier bars use --color-primary-subtle", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const bars = screen.getAllByTestId("mood-bar");
    for (let i = 0; i < 12; i++) {
      expect(bars[i]!.className).toContain("bg-[var(--color-primary-subtle)]");
    }
  });

  it("each bar has a height style", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const bars = screen.getAllByTestId("mood-bar");
    bars.forEach((bar) => {
      expect(bar.getAttribute("style") ?? "").toMatch(/height/i);
    });
  });
});

// ── Label ────────────────────────────────────────────────────────────────────

describe("MoodCard — label", () => {
  it("renders today's mood label from data", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const label = screen.getByTestId("mood-label");
    expect(label.textContent?.trim()).toBe("Good");
  });

  it("mood label uses the .headline-display utility class", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const label = screen.getByTestId("mood-label");
    expect(label.className).toContain("headline-display");
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe("MoodCard — empty state", () => {
  beforeEach(() => {
    vi.mocked(trpc.moodEntries.sparkline.useQuery).mockReturnValue({
      data: DATA_EMPTY,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof trpc.moodEntries.sparkline.useQuery>);
  });

  it("renders the empty-state message", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    expect(screen.getByTestId("mood-empty")).toBeInTheDocument();
    expect(screen.getByTestId("mood-empty").textContent).toContain(
      "No mood entries yet",
    );
  });

  it("does not render sparkline bars in empty state", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    expect(screen.queryAllByTestId("mood-bar")).toHaveLength(0);
  });
});

// ── Loading state ─────────────────────────────────────────────────────────────

describe("MoodCard — loading state", () => {
  beforeEach(() => {
    vi.mocked(trpc.moodEntries.sparkline.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof trpc.moodEntries.sparkline.useQuery>);
  });

  it("renders skeleton placeholder bars", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const bars = screen.getAllByTestId("mood-bar");
    expect(bars).toHaveLength(13);
  });

  it("skeleton bars show aria-busy on the section", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const section = screen.getByRole("region", { name: /mood/i });
    expect(section).toHaveAttribute("aria-busy", "true");
  });

  it("renders mood-loading indicator", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    expect(screen.getByTestId("mood-loading")).toBeInTheDocument();
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe("MoodCard — accessibility", () => {
  it("is a region labeled 'Mood'", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    expect(screen.getByRole("region", { name: /mood/i })).toBeInTheDocument();
  });

  it("sparkline has a descriptive aria-label", () => {
    render(<MoodCard recipientId={REC_ID} orgId={ORG_ID} />);
    const chart = screen.getByTestId("mood-sparkline");
    const label = chart.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(10);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <MoodCard recipientId={REC_ID} orgId={ORG_ID} />,
    );
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});
