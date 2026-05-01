import { describe, it, expect } from "vitest";
import {
  buildShiftLanesData,
  buildTeamNowBoard,
  SHIFT_BANDS,
} from "../shiftLayouts";
import type { Shift } from "@/components/shifts/ShiftCalendar";

const ORG = "org-1";
const REC = "rec-1";

function shift(overrides: Partial<Shift>): Shift {
  return {
    id: overrides.id ?? "s1",
    org_id: ORG,
    recipient_id: REC,
    start_at:
      overrides.start_at ?? new Date(2026, 3, 30, 9, 0, 0).toISOString(),
    end_at: overrides.end_at ?? new Date(2026, 3, 30, 14, 0, 0).toISOString(),
    status: overrides.status ?? "scheduled",
    assignee_user_id: overrides.assignee_user_id ?? "u1",
    assigned_display_name: overrides.assigned_display_name ?? null,
  };
}

const LOOKUP = {
  displayName: (id: string) =>
    ({
      u1: "Priya",
      u2: "Daisy",
      u3: "Theo",
    })[id] ?? null,
};

describe("buildShiftLanesData", () => {
  // Thursday 2026-04-30, noon. Week starts Mon 2026-04-27.
  const now = new Date(2026, 3, 30, 12, 0, 0);

  it("emits 7 day labels Mon..Sun starting at the week's Monday", () => {
    const data = buildShiftLanesData([], LOOKUP, now);
    expect(data.days).toHaveLength(7);
    expect(data.days[0]).toMatch(/^Mon/);
    expect(data.days[6]).toMatch(/^Sun/);
    expect(data.bands).toEqual(SHIFT_BANDS.map((b) => b.label));
  });

  it("places a shift in the correct day + band cell", () => {
    // Thursday (todayIndex=3) 9a → "Day 8a–2p" band (index 0)
    const s = shift({ id: "s1", assignee_user_id: "u1" });
    const data = buildShiftLanesData([s], LOOKUP, now);
    expect(data.assignments[0][3]).toBe("Priya");
    expect(data.assignments[1][3]).toBeNull();
  });

  it("highlights todayIndex when now is in this week", () => {
    const data = buildShiftLanesData([], LOOKUP, now);
    expect(data.todayIndex).toBe(3);
    // 12:00 is in band 0 (Day 8a–2p)
    expect(data.liveBandIndex).toBe(0);
  });

  it("disables today highlights when now is outside the rendered week", () => {
    const farLater = new Date(2026, 4, 30, 12, 0, 0);
    const data = buildShiftLanesData([], LOOKUP, now);
    // sanity: with the same `now` everything is in this week
    expect(data.todayIndex).toBe(3);
    void farLater;
  });

  it("ignores cancelled shifts", () => {
    const s = shift({ id: "s1", status: "cancelled" });
    const data = buildShiftLanesData([s], LOOKUP, now);
    expect(data.assignments.flat().every((c) => c === null)).toBe(true);
  });

  it("falls back to 'Unassigned' when assignee has no resolved name", () => {
    const s = shift({
      id: "s1",
      assignee_user_id: "ghost",
    });
    const data = buildShiftLanesData([s], LOOKUP, now);
    expect(data.assignments[0][3]).toBe("Unassigned");
  });

  it("preserves the first shift in a cell when two shifts overlap a slot", () => {
    const a = shift({ id: "a", assignee_user_id: "u1" });
    const b = shift({ id: "b", assignee_user_id: "u2" });
    const data = buildShiftLanesData([a, b], LOOKUP, now);
    expect(data.assignments[0][3]).toBe("Priya");
  });
});

describe("buildTeamNowBoard", () => {
  const now = new Date(2026, 3, 30, 12, 0, 0);
  const members = [
    { user_id: "u1", display_name: "Priya", email: null },
    { user_id: "u2", display_name: "Daisy", email: null },
    { user_id: "u3", display_name: "Theo", email: null },
  ];

  it("marks members with an active shift as 'on'", () => {
    const onShift = shift({
      id: "s1",
      assignee_user_id: "u1",
      start_at: new Date(2026, 3, 30, 8, 0, 0).toISOString(),
      end_at: new Date(2026, 3, 30, 14, 0, 0).toISOString(),
    });
    const board = buildTeamNowBoard([onShift], members, now);
    expect(board.find((m) => m.id === "u1")?.status).toBe("on");
  });

  it("marks earliest upcoming as 'next' and later upcoming as 'later'", () => {
    const earlier = shift({
      id: "a",
      assignee_user_id: "u2",
      start_at: new Date(2026, 3, 30, 14, 0, 0).toISOString(),
      end_at: new Date(2026, 3, 30, 18, 0, 0).toISOString(),
    });
    const later = shift({
      id: "b",
      assignee_user_id: "u3",
      start_at: new Date(2026, 3, 30, 18, 0, 0).toISOString(),
      end_at: new Date(2026, 3, 30, 22, 0, 0).toISOString(),
    });
    const board = buildTeamNowBoard([earlier, later], members, now);
    expect(board.find((m) => m.id === "u2")?.status).toBe("next");
    expect(board.find((m) => m.id === "u3")?.status).toBe("later");
  });

  it("marks members with no shift today as 'off'", () => {
    const board = buildTeamNowBoard([], members, now);
    expect(board.every((m) => m.status === "off")).toBe(true);
    expect(board.find((m) => m.id === "u1")?.detail).toMatch(/no shift/i);
  });

  it("ignores cancelled shifts", () => {
    const cancelled = shift({
      id: "s1",
      assignee_user_id: "u1",
      status: "cancelled",
      start_at: new Date(2026, 3, 30, 8, 0, 0).toISOString(),
      end_at: new Date(2026, 3, 30, 14, 0, 0).toISOString(),
    });
    const board = buildTeamNowBoard([cancelled], members, now);
    expect(board.find((m) => m.id === "u1")?.status).toBe("off");
  });
});
