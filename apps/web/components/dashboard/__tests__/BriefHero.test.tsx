import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { BriefHero } from "../BriefHero";
import { trpc } from "@/lib/trpc";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

// ─── Mock tRPC ────────────────────────────────────────────────────────────────

vi.mock("@/lib/trpc", () => ({
  trpc: {
    briefs: {
      latestForRecipient: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// ─── Shared props ─────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  recipientId: "00000000-0000-0000-0000-000000000001",
  orgId: "00000000-0000-0000-0000-000000000002",
};

// ─── Sample brief ─────────────────────────────────────────────────────────────

const SAMPLE_BRIEF = {
  id: "00000000-0000-0000-0000-000000000099",
  title: "Eleanor had a settled night",
  content: {
    medications: [
      { drug_name: "Lisinopril", dosage: "10mg", instructions: "once daily" },
      { drug_name: "Metoprolol", dosage: "25mg", instructions: "twice daily" },
    ],
    recent_entries: [
      { mood: "calm", text: "She ate well today." },
      { mood: "good", text: "Morning routine on pace." },
    ],
  },
  includes: ["medications", "journal"],
  created_at: "2026-04-28T07:02:00.000Z",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockQuery(overrides: {
  data?: typeof SAMPLE_BRIEF | null;
  isLoading?: boolean;
  isError?: boolean;
}) {
  vi.mocked(trpc.briefs.latestForRecipient.useQuery).mockReturnValue({
    data: overrides.data !== undefined ? overrides.data : SAMPLE_BRIEF,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  } as ReturnType<typeof trpc.briefs.latestForRecipient.useQuery>);
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe("BriefHero — loading state", () => {
  beforeEach(() => {
    mockQuery({ data: undefined, isLoading: true });
  });

  it("renders the structural shell (blob, eyebrow, headline, pill placeholders)", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("brief-blob")).toBeInTheDocument();
    expect(screen.getByTestId("brief-eyebrow")).toBeInTheDocument();
    expect(screen.getByTestId("brief-headline")).toBeInTheDocument();
    expect(screen.getByTestId("brief-status-pill")).toBeInTheDocument();
  });

  it("marks the section as busy", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    expect(screen.getByRole("region", { name: /today's brief/i })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("eyebrow is still visible during load", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("brief-eyebrow")).toBeInTheDocument();
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe("BriefHero — empty state (no brief yet)", () => {
  beforeEach(() => {
    mockQuery({ data: null });
  });

  it("renders the eyebrow", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("brief-eyebrow")).toBeInTheDocument();
  });

  it("shows a helpful 'no brief yet' message pointing to the journal page", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    const headline = screen.getByTestId("brief-headline");
    expect(headline.textContent?.toLowerCase()).toMatch(/no brief yet/i);
    expect(headline.textContent?.toLowerCase()).toMatch(/journal/i);
  });

  it("does NOT fall back to mock data", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    expect(screen.queryByText(/Eleanor/i)).toBeNull();
    expect(screen.queryByText(/settled night/i)).toBeNull();
  });

  it("renders no status pills in empty state", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    expect(screen.queryByTestId("brief-status-pill")).toBeNull();
  });
});

// ─── Loaded state ─────────────────────────────────────────────────────────────

describe("BriefHero — loaded state", () => {
  beforeEach(() => {
    mockQuery({ data: SAMPLE_BRIEF });
  });

  it("renders the eyebrow with real generated-at time", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    const eyebrow = screen.getByTestId("brief-eyebrow");
    expect(eyebrow.textContent?.toLowerCase()).toMatch(/brief/i);
    expect(eyebrow.textContent).toMatch(/auto-generated/i);
  });

  it("eyebrow uses the .eyebrow-mono utility class", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    const eyebrow = screen.getByTestId("brief-eyebrow");
    expect(eyebrow.className).toContain("eyebrow-mono");
  });

  it("headline uses the .headline-display utility class (Fraunces adoption)", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    const headline = screen.getByTestId("brief-headline");
    expect(headline.className).toContain("headline-display");
  });

  it("headline renders the brief title from real data", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    const headline = screen.getByTestId("brief-headline");
    expect(headline.textContent).toContain(SAMPLE_BRIEF.title);
  });

  it("renders at least one status pill derived from brief content", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    const pills = screen.getAllByTestId("brief-status-pill");
    expect(pills.length).toBeGreaterThanOrEqual(1);
  });

  it("pill labels reflect medication count from content", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    const pills = screen.getAllByTestId("brief-status-pill");
    const joined = pills.map((p) => p.textContent?.toLowerCase()).join(" ");
    expect(joined).toMatch(/2 meds/i);
  });

  it("pill labels reflect mood from most recent entry", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    const pills = screen.getAllByTestId("brief-status-pill");
    const joined = pills.map((p) => p.textContent?.toLowerCase()).join(" ");
    expect(joined).toMatch(/mood/i);
  });

  it("renders a primary-subtle blurred decorative blob", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    const blob = screen.getByTestId("brief-blob");
    expect(blob.className).toContain("bg-[var(--color-primary-subtle)]");
    expect(blob.className).toContain("blur");
    expect(blob.getAttribute("aria-hidden")).toBe("true");
  });

  it("is a labeled region", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    expect(
      screen.getByRole("region", { name: /today's brief/i }),
    ).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<BriefHero {...DEFAULT_PROPS} />);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe("BriefHero — error state", () => {
  beforeEach(() => {
    mockQuery({ data: undefined, isError: true });
  });

  it("renders an inline error message", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    const headline = screen.getByTestId("brief-headline");
    expect(headline.textContent?.toLowerCase()).toMatch(/could not load/i);
  });

  it("preserves the eyebrow in error state", () => {
    render(<BriefHero {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("brief-eyebrow")).toBeInTheDocument();
  });
});
