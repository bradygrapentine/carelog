// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
  wrapAdminError: (e: unknown) => e,
}));
vi.mock("../../../server/resend.server", () => ({ resend: null }));

import { supabaseAdmin } from "../../../server/supabaseAdmin.server";
import {
  buildTaskEmail,
  taskDedupKey,
  resolveTargetUserIds,
  type TaskNotificationEventData,
} from "../taskNotificationFanout";

const ORG = "11110000-0000-0000-0000-000000000001";
const REC = "22220000-0000-0000-0000-000000000001";
const TASK = "33330000-0000-0000-0000-000000000001";
const ACTOR = "44440000-0000-0000-0000-000000000001";
const ASSIGNEE = "55550000-0000-0000-0000-000000000001";
const REQUESTER = "66660000-0000-0000-0000-000000000001";
const OUTSIDER = "77770000-0000-0000-0000-000000000001";
const ONCALL = "88880000-0000-0000-0000-000000000001";

type Result = { data: unknown; error: unknown };

// Chainable builder that resolves (awaited) to `result`. Every query verb returns
// the chain; awaiting it yields the table's queued result.
function chain(result: Result) {
  const c: Record<string, unknown> = {};
  for (const m of [
    "select",
    "eq",
    "not",
    "in",
    "lte",
    "gt",
    "is",
    "order",
    "limit",
  ]) {
    c[m] = () => c;
  }
  c.then = (onF: (r: Result) => unknown) => Promise.resolve(result).then(onF);
  return c;
}

function mockFrom(byTable: Record<string, Result>) {
  (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => chain(byTable[table] ?? { data: [], error: null }),
  );
}

const baseTask = {
  org_id: ORG,
  recipient_id: REC,
  assigned_to: ASSIGNEE,
  requested_by: REQUESTER,
  title: "Pick up prescriptions",
};

function evt(
  type: TaskNotificationEventData["type"],
): TaskNotificationEventData {
  return { type, taskId: TASK, orgId: ORG, recipientId: REC, actorId: ACTOR };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildTaskEmail (FIND-001 — PHI-safe)", () => {
  it("uses a generic subject with no task content", () => {
    const { subject } = buildTaskEmail("task_assigned", "Pick up Rx for John");
    expect(subject).toBe("A task update from CareSync");
    expect(subject.toLowerCase()).not.toContain("john");
  });

  it("body carries the task title but no recipient email/phone identifiers", () => {
    const { body } = buildTaskEmail("task_completed", "Refill meds");
    expect(body).toContain("Refill meds");
    // PHI sentinel: no email address or phone-number patterns leak into the body.
    expect(body).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(body).not.toMatch(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  });

  it("renders a label per type", () => {
    expect(buildTaskEmail("task_created", null).body).toContain(
      "A new task was created.",
    );
  });
});

describe("taskDedupKey", () => {
  it("is stable per (type, task, user)", () => {
    expect(taskDedupKey("task_assigned", TASK, ASSIGNEE)).toBe(
      `task_assigned:${TASK}:${ASSIGNEE}`,
    );
  });
});

describe("resolveTargetUserIds — FIND-002 cross-team scoping + actor exclusion", () => {
  it("task_assigned targets the assignee when they are on the care team", async () => {
    mockFrom({
      memberships: {
        data: [{ user_id: ASSIGNEE, recipient_id: REC }],
        error: null,
      },
    });
    const out = await resolveTargetUserIds(
      evt("task_assigned"),
      baseTask,
      new Date(),
    );
    expect(out).toEqual([ASSIGNEE]);
  });

  it("excludes a candidate who is NOT a member of the recipient's care team", async () => {
    mockFrom({ memberships: { data: [], error: null } }); // assignee not a member
    const out = await resolveTargetUserIds(
      evt("task_assigned"),
      baseTask,
      new Date(),
    );
    expect(out).toEqual([]);
  });

  it("never targets the actor (self-action)", async () => {
    mockFrom({
      memberships: {
        data: [{ user_id: ACTOR, recipient_id: REC }],
        error: null,
      },
    });
    const out = await resolveTargetUserIds(
      evt("task_assigned"),
      { ...baseTask, assigned_to: ACTOR },
      new Date(),
    );
    expect(out).toEqual([]);
  });

  it("task_completed notifies the requester (verified member)", async () => {
    mockFrom({
      memberships: {
        data: [{ user_id: REQUESTER, recipient_id: null }], // org-wide membership
        error: null,
      },
    });
    const out = await resolveTargetUserIds(
      evt("task_completed"),
      baseTask,
      new Date(),
    );
    expect(out).toContain(REQUESTER);
  });

  it("task_created routes to the on-call assignee covering now, if on the team", async () => {
    mockFrom({
      shifts: { data: [{ assignee_user_id: ONCALL }], error: null },
      memberships: {
        data: [{ user_id: ONCALL, recipient_id: REC }],
        error: null,
      },
    });
    const out = await resolveTargetUserIds(
      evt("task_created"),
      baseTask,
      new Date(),
    );
    expect(out).toEqual([ONCALL]);
  });

  it("task_created with an on-call assignee NOT on the team yields no target", async () => {
    mockFrom({
      shifts: { data: [{ assignee_user_id: OUTSIDER }], error: null },
      memberships: { data: [], error: null },
    });
    const out = await resolveTargetUserIds(
      evt("task_created"),
      baseTask,
      new Date(),
    );
    expect(out).toEqual([]);
  });
});
