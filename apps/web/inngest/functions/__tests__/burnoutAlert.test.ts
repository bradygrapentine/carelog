// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  detectBurnoutRisk,
  selectBurnoutAlertInserts,
  type CheckInRow,
} from "../burnoutAlert";

const BASE: CheckInRow = {
  user_id: "user-a",
  org_id: "00000000-0000-0000-0000-000000000001",
  week_stamp: "2026-W14",
  stress_score: 4,
};

describe("detectBurnoutRisk", () => {
  it("returns user_id when stress_score >= 4 for 2 consecutive weeks", () => {
    const checkins: CheckInRow[] = [
      { ...BASE, week_stamp: "2026-W13", stress_score: 4 },
      { ...BASE, week_stamp: "2026-W14", stress_score: 5 },
    ];
    expect(detectBurnoutRisk(checkins)).toContain("user-a");
  });

  it("does NOT flag user with only 1 high-stress week", () => {
    const checkins: CheckInRow[] = [
      { ...BASE, week_stamp: "2026-W13", stress_score: 2 },
      { ...BASE, week_stamp: "2026-W14", stress_score: 5 },
    ];
    expect(detectBurnoutRisk(checkins)).toHaveLength(0);
  });

  it("does NOT flag user with stress_score of exactly 3 (threshold is >= 4)", () => {
    const checkins: CheckInRow[] = [
      { ...BASE, week_stamp: "2026-W13", stress_score: 3 },
      { ...BASE, week_stamp: "2026-W14", stress_score: 3 },
    ];
    expect(detectBurnoutRisk(checkins)).toHaveLength(0);
  });

  it("resets streak when a low-stress week breaks the run", () => {
    const checkins: CheckInRow[] = [
      { ...BASE, week_stamp: "2026-W12", stress_score: 5 },
      { ...BASE, week_stamp: "2026-W13", stress_score: 2 }, // breaks streak
      { ...BASE, week_stamp: "2026-W14", stress_score: 5 },
    ];
    expect(detectBurnoutRisk(checkins)).toHaveLength(0);
  });

  it("handles multiple users independently", () => {
    const checkins: CheckInRow[] = [
      { ...BASE, user_id: "user-a", week_stamp: "2026-W13", stress_score: 4 },
      { ...BASE, user_id: "user-a", week_stamp: "2026-W14", stress_score: 4 },
      { ...BASE, user_id: "user-b", week_stamp: "2026-W13", stress_score: 1 },
      { ...BASE, user_id: "user-b", week_stamp: "2026-W14", stress_score: 5 },
    ];
    const result = detectBurnoutRisk(checkins);
    expect(result).toContain("user-a");
    expect(result).not.toContain("user-b");
  });

  it("returns empty array for empty input", () => {
    expect(detectBurnoutRisk([])).toHaveLength(0);
  });

  it("flags at streak of exactly 2 (boundary condition)", () => {
    const checkins: CheckInRow[] = [
      { ...BASE, week_stamp: "2026-W13", stress_score: 4 },
      { ...BASE, week_stamp: "2026-W14", stress_score: 4 },
    ];
    expect(detectBurnoutRisk(checkins)).toHaveLength(1);
  });
});

// TD-212: the per-org dedup decision behind the batched fetch (replaces the
// per-user N+1 SELECT inside the Promise.all fan-out).
describe("selectBurnoutAlertInserts", () => {
  const ORG_X = "00000000-0000-0000-0000-0000000000a1";
  const ORG_Y = "00000000-0000-0000-0000-0000000000b1";

  it("emits one insert per distinct org", () => {
    const map = new Map([
      ["user-a", ORG_X],
      ["user-b", ORG_Y],
    ]);
    const out = selectBurnoutAlertInserts(["user-a", "user-b"], map, new Set());
    expect(out).toEqual([
      { userId: "user-a", orgId: ORG_X },
      { userId: "user-b", orgId: ORG_Y },
    ]);
  });

  it("dedups two at-risk users in the SAME org — first wins, no double-insert", () => {
    const map = new Map([
      ["user-a", ORG_X],
      ["user-b", ORG_X],
    ]);
    const out = selectBurnoutAlertInserts(["user-a", "user-b"], map, new Set());
    expect(out).toEqual([{ userId: "user-a", orgId: ORG_X }]);
  });

  it("skips an org already alerted this week (from the batched query)", () => {
    const map = new Map([["user-a", ORG_X]]);
    const out = selectBurnoutAlertInserts(["user-a"], map, new Set([ORG_X]));
    expect(out).toEqual([]);
  });

  it("skips a user with no org mapping", () => {
    const map = new Map([["user-b", ORG_Y]]);
    const out = selectBurnoutAlertInserts(["user-a", "user-b"], map, new Set());
    expect(out).toEqual([{ userId: "user-b", orgId: ORG_Y }]);
  });

  it("returns empty for no at-risk users", () => {
    expect(selectBurnoutAlertInserts([], new Map(), new Set())).toEqual([]);
  });
});
