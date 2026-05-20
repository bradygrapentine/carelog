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

import { appRouter } from "@/server/trpc/router";
import type { Context } from "@/server/trpc";

const USER_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const NOTIF_ID = "98dc6d19-6712-4b26-8797-b4e544e01b99";

type Result = { data: unknown; error: unknown };

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
    upsert: (p: unknown) => {
      captured.payload = p;
      return chain;
    },
    eq: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
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

beforeEach(() => vi.clearAllMocks());

describe("notifications.listInApp", () => {
  it("reads the in-app feed through the RLS-scoped client (owner-only)", async () => {
    const rows = [{ id: NOTIF_ID, type: "task_assigned", read_at: null }];
    const from = vi.fn(() => makeChain({ data: rows, error: null }, {}));
    const res = await caller(from).notifications.listInApp();
    expect(res).toEqual(rows);
    expect(from).toHaveBeenCalledWith("in_app_notifications");
  });
});

describe("notifications.markRead", () => {
  it("sets read_at and returns success", async () => {
    const cap: { payload?: unknown } = {};
    const from = vi.fn(() =>
      makeChain({ data: [{ id: NOTIF_ID }], error: null }, cap),
    );
    const res = await caller(from).notifications.markRead({ id: NOTIF_ID });
    expect(res).toEqual({ success: true });
    expect(cap.payload).toHaveProperty("read_at");
  });

  it("maps a 0-rows update (RLS non-owner) to NOT_FOUND", async () => {
    const from = vi.fn(() => makeChain({ data: [], error: null }, {}));
    await expect(
      caller(from).notifications.markRead({ id: NOTIF_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("notifications.taskPrefs / setTaskPrefs", () => {
  it("returns DB-default prefs when the user has no row", async () => {
    const from = vi.fn(() => makeChain({ data: null, error: null }, {}));
    const res = await caller(from).notifications.taskPrefs();
    expect(res).toEqual({
      task_assigned: true,
      task_completed: true,
      task_created: false,
    });
  });

  it("setTaskPrefs upserts the caller's own row (user_id forced server-side)", async () => {
    const cap: { payload?: unknown } = {};
    const from = vi.fn(() => makeChain({ data: null, error: null }, cap));
    await caller(from).notifications.setTaskPrefs({
      task_assigned: false,
      task_completed: true,
      task_created: true,
    });
    const payload = cap.payload as Record<string, unknown>;
    expect(payload.user_id).toBe(USER_ID);
    expect(payload.task_assigned).toBe(false);
  });
});
