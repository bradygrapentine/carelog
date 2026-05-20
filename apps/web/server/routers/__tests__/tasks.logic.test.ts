// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
  wrapAdminError: (e: unknown) => e,
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { appRouter } from "@/server/trpc/router";
import type { Context } from "@/server/trpc";

const USER_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const RECIPIENT_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const TASK_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";
const ASSIGNEE_ID = "58dc6d19-6712-4b26-8797-b4e544e01b88";

type Result = { data: unknown; error: unknown };

// Chainable supabase-query mock: every builder method returns the chain; the
// chain is awaitable (resolves to `result`); single/maybeSingle resolve too.
// `captured` records the payload passed to insert/update for assertion.
function makeChain(result: Result, captured: { payload?: unknown }) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    insert: (p: unknown) => {
      captured.payload = p;
      return chain;
    },
    update: (p: unknown) => {
      captured.payload = p;
      return chain;
    },
    eq: () => chain,
    order: () => chain,
    not: () => chain,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (onF: (r: Result) => unknown) => Promise.resolve(result).then(onF),
  };
  return chain;
}

function caller(supabaseFrom: ReturnType<typeof vi.fn>) {
  return appRouter.createCaller({
    user: { id: USER_ID, email: "u@example.com" } as Context["user"],
    supabase: { from: supabaseFrom } as unknown as Context["supabase"],
    req: undefined,
  } as Context);
}

beforeEach(() => {
  vi.clearAllMocks();
  (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReset();
});

describe("tasks.create", () => {
  it("sets created_by/requested_by = caller and status=todo, resolving recipient org RLS-scoped", async () => {
    const cap: { payload?: unknown } = {};
    const from = vi.fn((table: string) =>
      table === "care_recipients"
        ? makeChain({ data: { org_id: ORG_ID }, error: null }, {})
        : makeChain({ data: { id: TASK_ID }, error: null }, cap),
    );
    const res = await caller(from).tasks.create({
      recipient_id: RECIPIENT_ID,
      title: "Pick up meds",
    });
    expect(res).toEqual({ id: TASK_ID });
    const payload = cap.payload as Record<string, unknown>;
    expect(payload.created_by).toBe(USER_ID);
    expect(payload.requested_by).toBe(USER_ID);
    expect(payload.status).toBe("todo");
    expect(payload.org_id).toBe(ORG_ID);
    // never touches the admin client
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it("maps an RLS WITH CHECK violation (42501) to FORBIDDEN", async () => {
    const from = vi.fn((table: string) =>
      table === "care_recipients"
        ? makeChain({ data: { org_id: ORG_ID }, error: null }, {})
        : makeChain(
            {
              data: null,
              error: { code: "42501", message: "row-level security" },
            },
            {},
          ),
    );
    await expect(
      caller(from).tasks.create({ recipient_id: RECIPIENT_ID, title: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("tasks.complete", () => {
  it("sends only {status:'done'} — never completed_by/completed_at (trigger owns them)", async () => {
    const cap: { payload?: unknown } = {};
    const from = vi.fn(() =>
      makeChain({ data: [{ id: TASK_ID, status: "done" }], error: null }, cap),
    );
    await caller(from).tasks.complete({ id: TASK_ID });
    const payload = cap.payload as Record<string, unknown>;
    expect(payload).toEqual({ status: "done" });
    expect(payload).not.toHaveProperty("completed_by");
    expect(payload).not.toHaveProperty("completed_at");
  });

  it("maps a trigger RAISE (tasks_complete_forbidden) to FORBIDDEN", async () => {
    const from = vi.fn(() =>
      makeChain(
        {
          data: null,
          error: { code: "P0001", message: "tasks_complete_forbidden" },
        },
        {},
      ),
    );
    await expect(
      caller(from).tasks.complete({ id: TASK_ID }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("maps a 0-rows result (RLS USING-denial, no error) to FORBIDDEN", async () => {
    const from = vi.fn(() => makeChain({ data: [], error: null }, {}));
    await expect(
      caller(from).tasks.complete({ id: TASK_ID }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("tasks.cancel", () => {
  it("sends {status:'cancelled'} and maps RAISE to FORBIDDEN", async () => {
    const cap: { payload?: unknown } = {};
    const ok = vi.fn(() =>
      makeChain({ data: [{ id: TASK_ID }], error: null }, cap),
    );
    await caller(ok).tasks.cancel({ id: TASK_ID });
    expect(cap.payload).toEqual({ status: "cancelled" });

    const denied = vi.fn(() =>
      makeChain(
        { data: null, error: { message: "tasks_cancel_forbidden" } },
        {},
      ),
    );
    await expect(
      caller(denied).tasks.cancel({ id: TASK_ID }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("tasks.assign", () => {
  it("rejects an assignee who is not on the task's care team", async () => {
    const from = vi.fn(() =>
      makeChain(
        { data: { org_id: ORG_ID, recipient_id: RECIPIENT_ID }, error: null },
        {},
      ),
    );
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeChain({ data: [], error: null }, {}),
    );
    await expect(
      caller(from).tasks.assign({ id: TASK_ID, assignee_user_id: ASSIGNEE_ID }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("FORBIDDEN when the task row is not visible to the caller", async () => {
    const from = vi.fn(() => makeChain({ data: null, error: null }, {}));
    await expect(
      caller(from).tasks.assign({ id: TASK_ID, assignee_user_id: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("tasks.list", () => {
  it("reads through the RLS-scoped client, not the admin client", async () => {
    const from = vi.fn(() =>
      makeChain({ data: [{ id: TASK_ID }], error: null }, {}),
    );
    const res = await caller(from).tasks.list({ recipient_id: RECIPIENT_ID });
    expect(res).toEqual([{ id: TASK_ID }]);
    expect(from).toHaveBeenCalledWith("tasks");
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});
