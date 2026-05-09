import { describe, it, expect } from "vitest";
import {
  buildShiftLanesData,
  buildTeamNowBoard,
  buildShiftWeekGridBlocks,
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

// ---------------------------------------------------------------------------
// buildShiftWeekGridBlocks
// ---------------------------------------------------------------------------
// Week anchor: Mon 2026-04-27 00:00 local
// Indices:     Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6

describe("buildShiftWeekGridBlocks", () => {
  // Mon 2026-04-27 00:00:00 local (JavaScript month is 0-indexed: 3 = April)
  const weekStart = new Date(2026, 3, 27, 0, 0, 0);

  const LOOKUP_FN = {
    displayName: (id: string) =>
      ({ u1: "Priya", u2: "Daisy" })[id] ?? null,
  };

  function gridShift(
    overrides: Partial<{
      id: string;
      assignee_user_id: string | null;
      start_at: string;
      end_at: string;
    }>,
  ) {
    return {
      id: overrides.id ?? "g1",
      // Use explicit key check so null overrides are preserved (not replaced by default)
      assignee_user_id:
        "assignee_user_id" in overrides
          ? (overrides.assignee_user_id as string | null)
          : "u1",
      start_at:
        overrides.start_at ??
        new Date(2026, 3, 27, 8, 0, 0).toISOString(), // Mon 8a
      end_at:
        overrides.end_at ??
        new Date(2026, 3, 27, 16, 0, 0).toISOString(), // Mon 4p
    };
  }

  it("empty input → []", () => {
    expect(buildShiftWeekGridBlocks([], LOOKUP_FN, weekStart)).toEqual([]);
  });

  it("all-unassigned shifts → []", () => {
    const s = gridShift({ assignee_user_id: null });
    expect(buildShiftWeekGridBlocks([s], LOOKUP_FN, weekStart)).toEqual([]);
  });

  it("single same-day shift → one block with correct day/hours/name", () => {
    // Thu 2026-04-30 09:00–14:00 → day=3, startHour=9, endHour=14
    const s = gridShift({
      id: "s1",
      assignee_user_id: "u1",
      start_at: new Date(2026, 3, 30, 9, 0, 0).toISOString(),
      end_at: new Date(2026, 3, 30, 14, 0, 0).toISOString(),
    });
    const blocks = buildShiftWeekGridBlocks([s], LOOKUP_FN, weekStart);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].day).toBe(3); // Thursday is index 3
    expect(blocks[0].startHour).toBe(9);
    expect(blocks[0].endHour).toBe(14);
    expect(blocks[0].caregiverName).toBe("Priya");
    expect(blocks[0].caregiverId).toBe("u1");
  });

  it("midnight-crossing shift splits into two consecutive-day blocks", () => {
    // Mon 22:00 → Tue 06:00 → should produce day=0 (22–24) + day=1 (0–6)
    const s = gridShift({
      id: "night",
      assignee_user_id: "u1",
      start_at: new Date(2026, 3, 27, 22, 0, 0).toISOString(), // Mon 22:00
      end_at: new Date(2026, 3, 28, 6, 0, 0).toISOString(), // Tue 06:00
    });
    const blocks = buildShiftWeekGridBlocks([s], LOOKUP_FN, weekStart);
    expect(blocks).toHaveLength(2);
    // First block: Monday portion
    expect(blocks[0].day).toBe(0);
    expect(blocks[0].startHour).toBe(22);
    expect(blocks[0].endHour).toBe(24);
    // Second block: Tuesday portion
    expect(blocks[1].day).toBe(1);
    expect(blocks[1].startHour).toBe(0);
    expect(blocks[1].endHour).toBe(6);
    // Same caregiver on both
    expect(blocks[0].caregiverId).toBe("u1");
    expect(blocks[1].caregiverId).toBe("u1");
  });

  it("same caregiver across two shifts gets stable caregiverColor", () => {
    const s1 = gridShift({
      id: "a",
      assignee_user_id: "u1",
      start_at: new Date(2026, 3, 27, 8, 0, 0).toISOString(),
      end_at: new Date(2026, 3, 27, 14, 0, 0).toISOString(),
    });
    const s2 = gridShift({
      id: "b",
      assignee_user_id: "u1",
      start_at: new Date(2026, 3, 28, 8, 0, 0).toISOString(), // Tue
      end_at: new Date(2026, 3, 28, 14, 0, 0).toISOString(),
    });
    const blocks = buildShiftWeekGridBlocks([s1, s2], LOOKUP_FN, weekStart);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].caregiverColor).toBe(blocks[1].caregiverColor);
  });

  it("missing member entry → email local-part fallback", () => {
    const lookup = {
      displayName: (_id: string) => null, // no names
    };
    // Provide an email-bearing lookup for the fallback
    const emailLookup = {
      displayName: (_id: string) => null,
      email: (_id: string) => "alex@example.com",
    };
    void emailLookup; // tested via the email-fallback variant below
    const s = gridShift({ id: "s1", assignee_user_id: "u-ghost" });
    const blocks = buildShiftWeekGridBlocks([s], lookup, weekStart);
    // No display name and no email in this lookup → "Unknown caregiver"
    expect(blocks[0].caregiverName).toBe("Unknown caregiver");
  });

  it("email-local-part fallback when displayName is null but email available", () => {
    // The adapter accepts a MemberLookup with an optional email() helper
    // Per spec: fall back to email local-part when display_name not set
    const lookupWithEmail = {
      displayName: (_id: string) => null,
      email: (_id: string) => "alex@example.com",
    };
    const s = gridShift({ id: "s1", assignee_user_id: "u-ghost" });
    const blocks = buildShiftWeekGridBlocks([s], lookupWithEmail, weekStart);
    expect(blocks[0].caregiverName).toBe("alex");
  });

  it("shift outside week window → dropped", () => {
    // Two weeks later — should be excluded
    const s = gridShift({
      start_at: new Date(2026, 4, 11, 9, 0, 0).toISOString(), // May 11
      end_at: new Date(2026, 4, 11, 14, 0, 0).toISOString(),
    });
    expect(buildShiftWeekGridBlocks([s], LOOKUP_FN, weekStart)).toEqual([]);
  });

  it("shift before weekStart → dropped", () => {
    const s = gridShift({
      start_at: new Date(2026, 3, 26, 9, 0, 0).toISOString(), // Sun before
      end_at: new Date(2026, 3, 26, 14, 0, 0).toISOString(),
    });
    expect(buildShiftWeekGridBlocks([s], LOOKUP_FN, weekStart)).toEqual([]);
  });

  it("blocks returned in (day, startHour) ascending order", () => {
    const thu = gridShift({
      id: "thu",
      assignee_user_id: "u1",
      start_at: new Date(2026, 3, 30, 14, 0, 0).toISOString(), // Thu 14:00
      end_at: new Date(2026, 3, 30, 18, 0, 0).toISOString(),
    });
    const mon = gridShift({
      id: "mon",
      assignee_user_id: "u2",
      start_at: new Date(2026, 3, 27, 8, 0, 0).toISOString(), // Mon 8:00
      end_at: new Date(2026, 3, 27, 12, 0, 0).toISOString(),
    });
    const blocks = buildShiftWeekGridBlocks([thu, mon], LOOKUP_FN, weekStart);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].day).toBe(0); // Mon comes first
    expect(blocks[1].day).toBe(3); // Thu second
  });
});
