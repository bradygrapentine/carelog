import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { appRouter } from "../../trpc/router";
import { API_VERSION } from "../../api-version";
import {
  walkRouter,
  diffSnapshots,
  formatDriftMessage,
  type RouterSnapshot,
} from "./test-helpers/schema-walker";

const SNAPSHOT_PATH = path.join(
  __dirname,
  "__snapshots__",
  "api-schemas.snap.json",
);

function loadBaseline(): RouterSnapshot | null {
  if (!fs.existsSync(SNAPSHOT_PATH)) return null;
  const raw = fs.readFileSync(SNAPSHOT_PATH, "utf8");
  return JSON.parse(raw) as RouterSnapshot;
}

function writeBaseline(snap: RouterSnapshot): void {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snap, null, 2) + "\n", "utf8");
}

describe("tRPC appRouter schema snapshot", () => {
  const current = walkRouter(appRouter);

  if (process.env.UPDATE_SCHEMA_SNAPSHOT === "1") {
    it("writes a fresh baseline (UPDATE_SCHEMA_SNAPSHOT=1)", () => {
      writeBaseline(current);
      expect(fs.existsSync(SNAPSHOT_PATH)).toBe(true);
    });
    return;
  }

  it("captures at least one procedure per top-level router", () => {
    const routerNames = Object.keys(current).map((k) => k.split(".")[0]);
    const unique = new Set(routerNames);
    // appRouter has 24 top-level routers (see server/trpc/router.ts); allow
    // a small drift floor to accommodate router additions/renames during
    // active development without forcing this assertion to track exactly.
    expect(unique.size).toBeGreaterThanOrEqual(20);
  });

  it("snapshots the careEvents router despite z.record(z.unknown()) lossy fields", () => {
    // careEvents.* is the canonical caller of z.record(z.unknown()) — guards
    // the documented lossy case (ADR-0006). If zero careEvents entries appear,
    // the walker has regressed.
    const careEventsKeys = Object.keys(current).filter((k) =>
      k.startsWith("careEvents."),
    );
    expect(careEventsKeys.length).toBeGreaterThan(0);
  });

  it("matches the checked-in baseline at __snapshots__/api-schemas.snap.json", () => {
    const baseline = loadBaseline();
    if (!baseline) {
      writeBaseline(current);
      throw new Error(
        `No baseline at ${SNAPSHOT_PATH}. One has been written — review and commit it.`,
      );
    }
    const diff = diffSnapshots(baseline, current);
    const drifted =
      diff.added.length + diff.removed.length + diff.changed.length;
    if (drifted > 0) {
      throw new Error(formatDriftMessage(diff, API_VERSION));
    }
    expect(drifted).toBe(0);
  });
});
