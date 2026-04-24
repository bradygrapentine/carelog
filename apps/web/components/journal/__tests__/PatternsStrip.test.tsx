import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { PatternsStrip } from "../PatternsStrip";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Helper to mock matchMedia
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
  mockMatchMedia(false);
  mockPush.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PatternsStrip — rendering", () => {
  it('renders the "PATTERNS WE\'VE NOTICED" heading', () => {
    render(<PatternsStrip recipientId="r1" />);
    expect(
      screen.getByRole("heading", { name: /PATTERNS WE'VE NOTICED/i }),
    ).toBeInTheDocument();
  });

  it("renders all 3 pattern cards", () => {
    render(<PatternsStrip recipientId="r1" />);
    const cards = screen.getAllByTestId("pattern-card");
    expect(cards).toHaveLength(3);
  });

  it("renders the anxiety/Tuesdays pattern text", () => {
    render(<PatternsStrip recipientId="r1" />);
    expect(
      screen.getByText(
        "Eleanor has been more anxious on Tuesdays (4 of last 5).",
      ),
    ).toBeInTheDocument();
  });

  it("renders the sleep/PT days pattern text", () => {
    render(<PatternsStrip recipientId="r1" />);
    expect(
      screen.getByText("Sleep drops by ~90 minutes after PT days."),
    ).toBeInTheDocument();
  });

  it("renders the mood/Priya pattern text", () => {
    render(<PatternsStrip recipientId="r1" />);
    expect(
      screen.getByText("Mood is highest when Priya visits."),
    ).toBeInTheDocument();
  });

  it("renders '(early experiment)' disclaimer", () => {
    render(<PatternsStrip recipientId="r1" />);
    expect(screen.getByText("(early experiment)")).toBeInTheDocument();
  });
});

describe("PatternsStrip — tint classes", () => {
  it("anxiety card has mood-okay tint class", () => {
    render(<PatternsStrip recipientId="r1" />);
    const cards = screen.getAllByTestId("pattern-card");
    const anxietyCard = cards.find(
      (c) => (c as HTMLElement).dataset.patternId === "anxiety-tuesdays",
    ) as HTMLElement;
    expect(anxietyCard.className).toContain("bg-[var(--color-mood-okay)]/15");
  });

  it("sleep card has primary-subtle tint class", () => {
    render(<PatternsStrip recipientId="r1" />);
    const cards = screen.getAllByTestId("pattern-card");
    const sleepCard = cards.find(
      (c) => (c as HTMLElement).dataset.patternId === "sleep-pt-days",
    ) as HTMLElement;
    expect(sleepCard.className).toContain("bg-[var(--color-primary-subtle)]");
  });

  it("mood card has secondary-subtle tint class", () => {
    render(<PatternsStrip recipientId="r1" />);
    const cards = screen.getAllByTestId("pattern-card");
    const moodCard = cards.find(
      (c) => (c as HTMLElement).dataset.patternId === "mood-priya",
    ) as HTMLElement;
    expect(moodCard.className).toContain(
      "bg-[var(--color-secondary-subtle)]",
    );
  });
});

describe("PatternsStrip — keyboard / interaction", () => {
  it("renders 3 'View entries →' buttons (one per card)", () => {
    render(<PatternsStrip recipientId="r1" />);
    const buttons = screen.getAllByRole("button", { name: /View entries/i });
    expect(buttons).toHaveLength(3);
  });

  it("calls router.push with filter param when 'View entries' is clicked", () => {
    render(<PatternsStrip recipientId="r1" />);
    const buttons = screen.getAllByRole("button", { name: /View entries/i });
    fireEvent.click(buttons[0]);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("/journal/r1"),
    );
  });

  it("buttons are reachable by Tab (in tab order)", () => {
    render(<PatternsStrip recipientId="r1" />);
    const buttons = screen.getAllByRole("button", { name: /View entries/i });
    // All buttons must be in the document and focusable (tabIndex not -1)
    buttons.forEach((btn) => {
      expect(btn).toBeInTheDocument();
      expect((btn as HTMLButtonElement).tabIndex).not.toBe(-1);
    });
  });
});

describe("PatternsStrip — reduced motion", () => {
  it("scroll container gets data-reduced-motion=false by default", () => {
    mockMatchMedia(false);
    render(<PatternsStrip recipientId="r1" />);
    const container = screen.getByTestId("patterns-scroll-container");
    expect((container as HTMLElement).dataset.reducedMotion).toBe("false");
  });

  it("scroll container gets data-reduced-motion=true when prefers-reduced-motion is set", () => {
    mockMatchMedia(true);
    render(<PatternsStrip recipientId="r1" />);
    const container = screen.getByTestId("patterns-scroll-container");
    expect((container as HTMLElement).dataset.reducedMotion).toBe("true");
  });
});

describe("PatternsStrip — accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(<PatternsStrip recipientId="r1" />);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});
