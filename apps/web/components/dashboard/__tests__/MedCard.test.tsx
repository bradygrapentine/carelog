import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { MedCard } from "../MedCard";
import { trpc } from "@/lib/trpc";

// @ts-expect-error TD-16: vitest-axe/matchers uses 'export type *'; runtime JS exports the value fine
expect.extend({ toHaveNoViolations });

const { mockLogAdministration, mockInvalidate } = vi.hoisted(() => ({
  mockLogAdministration: vi.fn(),
  mockInvalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      medications: { todayLog: { invalidate: mockInvalidate } },
    }),
    medications: {
      listScheduled: { useQuery: vi.fn() },
      todayLog: { useQuery: vi.fn() },
      weekData: { useQuery: vi.fn() },
      logAdministration: { useMutation: vi.fn() },
    },
  },
}));

const ORG_ID = "10000000-0000-0000-0000-000000000001";
const REC_ID = "20000000-0000-0000-0000-000000000001";

const PROPS = { orgId: ORG_ID, recipientId: REC_ID };

// Two scheduled doses: one taken, one not
const scheduledData = [
  {
    id: "sched-1",
    scheduled_time: "08:00:00",
    medications: { id: "med-1", drug_name: "Lisinopril", dosage: "10mg" },
  },
  {
    id: "sched-2",
    scheduled_time: "20:00:00",
    medications: { id: "med-2", drug_name: "Atorvastatin", dosage: "20mg" },
  },
];

// med-1 has been taken today
const takenLogData = [
  { medication_id: "med-1", scheduled_time: "08:00:00", action: "given" },
];

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({
    data: scheduledData,
    isLoading: false,
    isError: false,
  } as any);

  vi.mocked(trpc.medications.todayLog.useQuery).mockReturnValue({
    data: takenLogData,
    isLoading: false,
    isError: false,
  } as any);

  vi.mocked(trpc.medications.weekData.useQuery).mockReturnValue({
    data: { schedules: [], events: [] },
    isLoading: false,
    isError: false,
  } as any);

  vi.mocked(trpc.medications.logAdministration.useMutation).mockReturnValue({
    mutate: mockLogAdministration,
    isPending: false,
  } as any);
});

// ─── rendering with data ───────────────────────────────────────────────────────

describe("MedCard — rendering with real data", () => {
  it("renders a section labeled 'Medications'", () => {
    render(<MedCard {...PROPS} />);
    expect(
      screen.getByRole("region", { name: /medications/i }),
    ).toBeInTheDocument();
  });

  it("renders both med rows", () => {
    render(<MedCard {...PROPS} />);
    expect(screen.getAllByTestId("med-row")).toHaveLength(2);
  });

  it("renders both med names", () => {
    render(<MedCard {...PROPS} />);
    const names = screen.getAllByTestId("med-name");
    const texts = names.map((n) => n.textContent ?? "");
    expect(texts.some((t) => t.includes("Lisinopril"))).toBe(true);
    expect(texts.some((t) => t.includes("Atorvastatin"))).toBe(true);
  });

  it("the taken row (med-1) has data-taken=true", () => {
    render(<MedCard {...PROPS} />);
    const takenRow = screen
      .getAllByTestId("med-row")
      .find((r) => (r as HTMLElement).dataset.medId === "med-1") as HTMLElement;
    expect(takenRow.dataset.taken).toBe("true");
  });

  it("the not-taken row (med-2) has data-taken=false", () => {
    render(<MedCard {...PROPS} />);
    const notTakenRow = screen
      .getAllByTestId("med-row")
      .find((r) => (r as HTMLElement).dataset.medId === "med-2") as HTMLElement;
    expect(notTakenRow.dataset.taken).toBe("false");
  });

  it("shows '1 / 2 logged' eyebrow", () => {
    render(<MedCard {...PROPS} />);
    expect(screen.getByText(/1\s*\/\s*2\s*logged/i)).toBeInTheDocument();
  });
});

// ─── taken rows ───────────────────────────────────────────────────────────────

describe("MedCard — taken rows", () => {
  it("taken rows apply strikethrough (line-through)", () => {
    render(<MedCard {...PROPS} />);
    const takenRow = screen
      .getAllByTestId("med-row")
      .find((r) => (r as HTMLElement).dataset.taken === "true") as HTMLElement;
    const nameEl = takenRow.querySelector(
      "[data-testid='med-name']",
    ) as HTMLElement;
    expect(nameEl.className).toContain("line-through");
  });

  it("taken rows apply 60% opacity", () => {
    render(<MedCard {...PROPS} />);
    const takenRow = screen
      .getAllByTestId("med-row")
      .find((r) => (r as HTMLElement).dataset.taken === "true") as HTMLElement;
    expect(takenRow.className).toMatch(/opacity-\[0?\.6\]|opacity-60/);
  });
});

// ─── log action ───────────────────────────────────────────────────────────────

describe("MedCard — log action", () => {
  it("not-taken row exposes a 'Log' button", () => {
    render(<MedCard {...PROPS} />);
    const row = screen
      .getAllByTestId("med-row")
      .find((r) => (r as HTMLElement).dataset.taken === "false") as HTMLElement;
    const logBtn = row.querySelector(
      "button[data-testid='med-log-btn']",
    ) as HTMLButtonElement;
    expect(logBtn).not.toBeNull();
    expect(logBtn.textContent?.toLowerCase()).toContain("log");
  });

  it("taken row does NOT show a Log button", () => {
    render(<MedCard {...PROPS} />);
    const row = screen
      .getAllByTestId("med-row")
      .find((r) => (r as HTMLElement).dataset.taken === "true") as HTMLElement;
    expect(row.querySelector("button[data-testid='med-log-btn']")).toBeNull();
  });

  it("clicking 'Log' calls logAdministration.mutate with correct args", () => {
    render(<MedCard {...PROPS} />);
    const notTakenRow = screen
      .getAllByTestId("med-row")
      .find((r) => (r as HTMLElement).dataset.medId === "med-2") as HTMLElement;
    const logBtn = notTakenRow.querySelector(
      "button[data-testid='med-log-btn']",
    ) as HTMLButtonElement;
    fireEvent.click(logBtn);
    expect(mockLogAdministration).toHaveBeenCalledWith({
      org_id: ORG_ID,
      recipient_id: REC_ID,
      medication_id: "med-2",
      scheduled_time: "20:00:00",
      action: "given",
    });
  });

  it("Log button has accessible aria-label including med name", () => {
    render(<MedCard {...PROPS} />);
    const row = screen
      .getAllByTestId("med-row")
      .find((r) => (r as HTMLElement).dataset.taken === "false") as HTMLElement;
    const logBtn = row.querySelector(
      "button[data-testid='med-log-btn']",
    ) as HTMLButtonElement;
    const label = logBtn.getAttribute("aria-label") ?? "";
    expect(label.length).toBeGreaterThan(3);
    expect(label.toLowerCase()).toContain("atorvastatin");
  });
});

// ─── loading state ────────────────────────────────────────────────────────────

describe("MedCard — loading state", () => {
  it("renders skeleton rows while loading", () => {
    vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any);
    vi.mocked(trpc.medications.todayLog.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any);
    render(<MedCard {...PROPS} />);
    expect(screen.getAllByTestId("med-row-skeleton")).toHaveLength(3);
    expect(screen.queryAllByTestId("med-row")).toHaveLength(0);
  });

  it("does NOT render the eyebrow count while loading", () => {
    vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any);
    vi.mocked(trpc.medications.todayLog.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any);
    render(<MedCard {...PROPS} />);
    expect(screen.queryByText(/logged/i)).toBeNull();
  });
});

// ─── empty state ──────────────────────────────────────────────────────────────

describe("MedCard — empty state", () => {
  it("shows empty-state message when no scheduled meds", () => {
    vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    vi.mocked(trpc.medications.todayLog.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    render(<MedCard {...PROPS} />);
    expect(screen.getByText(/no medications tracked yet/i)).toBeInTheDocument();
    expect(screen.queryAllByTestId("med-row")).toHaveLength(0);
  });

  it("empty state includes a link to the medications page", () => {
    vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    vi.mocked(trpc.medications.todayLog.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    render(<MedCard {...PROPS} />);
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/medications");
  });
});

// ─── error state ──────────────────────────────────────────────────────────────

describe("MedCard — error state", () => {
  it("shows an error alert when the query fails", () => {
    vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any);
    vi.mocked(trpc.medications.todayLog.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as any);
    render(<MedCard {...PROPS} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toMatch(/could not load/i);
  });
});

// ─── accessibility ────────────────────────────────────────────────────────────

describe("MedCard — accessibility", () => {
  it("has no axe violations (data loaded)", async () => {
    const { container } = render(<MedCard {...PROPS} />);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations (empty state)", async () => {
    vi.mocked(trpc.medications.listScheduled.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    vi.mocked(trpc.medications.todayLog.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
    const { container } = render(<MedCard {...PROPS} />);
    const results = await axe(container);
    // @ts-expect-error TD-16: vitest-axe augments Vi namespace (vitest<3.x); vitest 4.x uses @vitest/expect
    expect(results).toHaveNoViolations();
  });
});

// TD-211: missed-dose derivation reads the injected `now` anchor, not a live
// `new Date()`. med-2 (20:00, not taken) is "missed" only once `now` is past
// 20:00 — proves the useState anchor + closed-over helpers use the prop.
describe("MedCard — now anchor (TD-211 purity fix)", () => {
  it("flags the untaken 20:00 dose missed when now is after 20:00", () => {
    render(<MedCard {...PROPS} now={new Date(2026, 4, 20, 23, 59)} />);
    expect(
      screen.getByLabelText("Missed doses needing attention"),
    ).toBeInTheDocument();
  });

  it("does NOT flag the 20:00 dose missed when now is before 20:00", () => {
    render(<MedCard {...PROPS} now={new Date(2026, 4, 20, 0, 1)} />);
    expect(
      screen.queryByLabelText("Missed doses needing attention"),
    ).not.toBeInTheDocument();
  });
});
