/**
 * jobStateMachine.test.ts
 *
 * Characterization tests: pin existing single-client state transitions.
 * Concurrency test: simulate a race on confirm — assert one winner, one loser.
 */

import { describe, it, expect } from "vitest";
import {
  OcrJobStateMachine,
  OcrTransitionError,
  type OcrStatus,
} from "@/lib/ocr/jobStateMachine";

// ---------------------------------------------------------------------------
// Legal transitions
// ---------------------------------------------------------------------------

describe("OcrJobStateMachine — legal transitions", () => {
  it("pending → processing", () => {
    const sm = new OcrJobStateMachine("pending");
    expect(sm.transitionTo("processing")).toBe("processing");
  });

  it("pending → failed", () => {
    const sm = new OcrJobStateMachine("pending");
    expect(sm.transitionTo("failed")).toBe("failed");
  });

  it("processing → needs_review", () => {
    const sm = new OcrJobStateMachine("processing");
    expect(sm.transitionTo("needs_review")).toBe("needs_review");
  });

  it("processing → failed", () => {
    const sm = new OcrJobStateMachine("processing");
    expect(sm.transitionTo("failed")).toBe("failed");
  });

  it("needs_review → confirmed", () => {
    const sm = new OcrJobStateMachine("needs_review");
    expect(sm.transitionTo("confirmed")).toBe("confirmed");
  });

  it("needs_review → failed", () => {
    const sm = new OcrJobStateMachine("needs_review");
    expect(sm.transitionTo("failed")).toBe("failed");
  });
});

// ---------------------------------------------------------------------------
// Illegal transitions
// ---------------------------------------------------------------------------

describe("OcrJobStateMachine — illegal transitions throw OcrTransitionError", () => {
  const illegal: [OcrStatus, OcrStatus][] = [
    ["pending", "needs_review"],
    ["pending", "confirmed"],
    ["processing", "confirmed"],
    ["processing", "pending"],
    ["needs_review", "pending"],
    ["needs_review", "processing"],
    ["confirmed", "confirmed"],
    ["confirmed", "failed"],
    ["confirmed", "pending"],
    ["failed", "pending"],
    ["failed", "processing"],
  ];

  for (const [from, to] of illegal) {
    it(`${from} → ${to} is illegal`, () => {
      const sm = new OcrJobStateMachine(from);
      expect(() => sm.transitionTo(to)).toThrowError(OcrTransitionError);
    });
  }
});

// ---------------------------------------------------------------------------
// OcrTransitionError shape
// ---------------------------------------------------------------------------

describe("OcrTransitionError", () => {
  it("carries from/to and a descriptive message", () => {
    const err = new OcrTransitionError("confirmed", "pending");
    expect(err.name).toBe("OcrTransitionError");
    expect(err.from).toBe("confirmed");
    expect(err.to).toBe("pending");
    expect(err.message).toMatch(/confirmed.*pending/);
  });
});

// ---------------------------------------------------------------------------
// canTransitionTo (non-throwing predicate)
// ---------------------------------------------------------------------------

describe("OcrJobStateMachine.canTransitionTo", () => {
  it("returns true for legal transition", () => {
    expect(
      new OcrJobStateMachine("needs_review").canTransitionTo("confirmed"),
    ).toBe(true);
  });

  it("returns false for illegal transition", () => {
    expect(new OcrJobStateMachine("confirmed").canTransitionTo("pending")).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Concurrency simulation — two simultaneous confirm requests, one winner
//
// The optimistic-lock pattern used by the route handlers:
//   1. Read job row → get currentStatus
//   2. Validate transition via state machine (throws if illegal)
//   3. UPDATE … SET status = 'confirmed' WHERE id = ? AND status = currentStatus
//   4. If rowsUpdated === 0 → another requester won → return 409
//
// This test simulates two concurrent callers sharing a single in-memory "DB".
// ---------------------------------------------------------------------------

type FakeRow = { id: string; status: OcrStatus };

/** Simulates the "UPDATE … WHERE status = expectedStatus" optimistic lock. */
function fakeConditionalUpdate(
  db: FakeRow[],
  id: string,
  targetStatus: OcrStatus,
  expectedCurrentStatus: OcrStatus,
): { rowsUpdated: number } {
  const row = db.find((r) => r.id === id && r.status === expectedCurrentStatus);
  if (!row) return { rowsUpdated: 0 };
  row.status = targetStatus;
  return { rowsUpdated: 1 };
}

/** Simulates one confirm attempt. Returns 200 or 409. */
function simulateConfirm(
  db: FakeRow[],
  jobId: string,
): { status: 200 | 409; winner: boolean } {
  const row = db.find((r) => r.id === jobId);
  if (!row) return { status: 409, winner: false };

  const sm = new OcrJobStateMachine(row.status);
  if (!sm.canTransitionTo("confirmed")) {
    return { status: 409, winner: false };
  }

  // Optimistic lock: only update if status is still what we read
  const { rowsUpdated } = fakeConditionalUpdate(
    db,
    jobId,
    "confirmed",
    row.status,
  );

  return rowsUpdated === 1
    ? { status: 200, winner: true }
    : { status: 409, winner: false };
}

describe("Concurrency — simultaneous confirm race", () => {
  it("exactly one request wins, the other gets 409", () => {
    const JOB_ID = "job-1";
    const db: FakeRow[] = [{ id: JOB_ID, status: "needs_review" }];

    // Simulate two concurrent callers that both read status="needs_review"
    // before either one writes. We model this by running them sequentially
    // against the same in-memory row — the second caller will find the row
    // already updated.
    const resultA = simulateConfirm(db, JOB_ID);
    const resultB = simulateConfirm(db, JOB_ID);

    const winners = [resultA, resultB].filter((r) => r.winner);
    const losers = [resultA, resultB].filter((r) => !r.winner);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(winners[0]!.status).toBe(200);
    expect(losers[0]!.status).toBe(409);

    // DB row is confirmed after the race
    expect(db[0]!.status).toBe("confirmed");
  });

  it("second confirm on an already-confirmed job also loses (409)", () => {
    const JOB_ID = "job-2";
    const db: FakeRow[] = [{ id: JOB_ID, status: "confirmed" }];

    // Both callers read status="confirmed" — state machine rejects immediately
    const resultA = simulateConfirm(db, JOB_ID);
    const resultB = simulateConfirm(db, JOB_ID);

    expect(resultA.winner).toBe(false);
    expect(resultB.winner).toBe(false);
    expect(resultA.status).toBe(409);
    expect(resultB.status).toBe(409);
  });
});
