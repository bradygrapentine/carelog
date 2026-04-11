import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/server/repositories/careEventsRepository", () => ({
  getTimeline: vi.fn(),
  insertEvent: vi.fn(),
  getFlaggedEvents: vi.fn(),
  insertEventIdempotent: vi.fn(),
}));
vi.mock("@/server/repositories/membershipsRepository", () => ({
  getMemberships: vi.fn(),
  createMembershipAndInvite: vi.fn(),
}));
vi.mock("@/server/repositories/organizationsRepository", () => ({
  getOrganization: vi.fn(),
  createOrganization: vi.fn(),
  getUserOrganizations: vi.fn(),
}));
vi.mock("@/server/repositories/identityRepository", () => ({
  createIdentity: vi.fn(),
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import {
  getTimeline,
  insertEvent,
  getFlaggedEvents,
  insertEventIdempotent,
} from "@/server/repositories/careEventsRepository";
import { appRouter } from "@/server/trpc/router";

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const RECIPIENT_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const USER_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const EVENT_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

function makeSelectChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeSupabaseMock(result: object) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);
  return { from: vi.fn().mockReturnValue(chain) };
}

const baseInsertInput = {
  orgId: ORG_ID,
  recipientId: RECIPIENT_ID,
  eventType: "journal" as const,
  entryKind: "human" as const,
  payload: { text: "Today was hard" },
};

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(getTimeline).mockReset();
  vi.mocked(insertEvent).mockReset();
  vi.mocked(getFlaggedEvents).mockReset();
  vi.mocked(insertEventIdempotent).mockReset();
});

// ─── careEvents.timeline ─────────────────────────────────────────────────────

describe("careEvents.timeline — argument passing", () => {
  const fakeTimeline = [{ id: "e1" }, { id: "e2" }];

  it("passes recipientId, eventType, limit, and before to getTimeline and returns result", async () => {
    vi.mocked(getTimeline).mockResolvedValue(fakeTimeline as any);

    const supabaseMock = {} as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "actor@example.com" } as any,
      supabase: supabaseMock,
      req: undefined,
    });

    const result = await caller.careEvents.timeline({
      recipientId: RECIPIENT_ID,
      eventType: "journal",
      limit: 10,
      before: "2024-01-01T00:00:00Z",
    });

    expect(getTimeline).toHaveBeenCalledWith(supabaseMock, {
      recipientId: RECIPIENT_ID,
      eventType: "journal",
      limit: 10,
      before: "2024-01-01T00:00:00Z",
    });
    expect(result).toEqual(fakeTimeline);
  });

  it("passes default limit of 50 when limit is not specified", async () => {
    vi.mocked(getTimeline).mockResolvedValue([] as any);

    const supabaseMock = {} as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "actor@example.com" } as any,
      supabase: supabaseMock,
      req: undefined,
    });

    await caller.careEvents.timeline({ recipientId: RECIPIENT_ID });

    expect(getTimeline).toHaveBeenCalledWith(
      supabaseMock,
      expect.objectContaining({ limit: 50 }),
    );
  });
});

// ─── careEvents.insert ───────────────────────────────────────────────────────

describe("careEvents.insert — argument passing", () => {
  it("calls insertEvent with correct args including actorId from ctx.user.id", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { id: RECIPIENT_ID }, error: null }),
    );
    const fakeEvent = { id: "event-1" };
    vi.mocked(insertEvent).mockResolvedValue(fakeEvent as any);

    const supabaseMock = {} as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "actor@example.com" } as any,
      supabase: supabaseMock,
      req: undefined,
    });

    const result = await caller.careEvents.insert(baseInsertInput);

    expect(insertEvent).toHaveBeenCalledWith(supabaseMock, {
      orgId: ORG_ID,
      recipientId: RECIPIENT_ID,
      actorId: USER_ID,
      eventType: "journal",
      entryKind: "human",
      payload: { text: "Today was hard" },
      occurredAt: undefined,
      flagged: false,
    });
    expect(result).toEqual(fakeEvent);
  });

  it("calls insertEventIdempotent (not insertEvent) when idempotencyKey is provided", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { id: RECIPIENT_ID }, error: null }),
    );
    const fakeEvent = { id: "event-2" };
    vi.mocked(insertEventIdempotent).mockResolvedValue(fakeEvent as any);

    const supabaseMock = {} as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "actor@example.com" } as any,
      supabase: supabaseMock,
      req: undefined,
    });

    const result = await caller.careEvents.insert({
      ...baseInsertInput,
      idempotencyKey: "key-abc",
    });

    expect(insertEventIdempotent).toHaveBeenCalledWith(
      supabaseMock,
      expect.objectContaining({
        actorId: USER_ID,
        idempotencyKey: "key-abc",
      }),
    );
    expect(insertEvent).not.toHaveBeenCalled();
    expect(result).toEqual(fakeEvent);
  });

  it("throws FORBIDDEN when recipient does not belong to org", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: null }),
    );

    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "actor@example.com" } as any,
      supabase: {} as any,
      req: undefined,
    });

    await expect(
      caller.careEvents.insert(baseInsertInput),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(insertEvent).not.toHaveBeenCalled();
  });
});

// ─── careEvents.flagged ───────────────────────────────────────────────────────

describe("careEvents.flagged — argument passing", () => {
  it("calls getFlaggedEvents with recipientId and returns result", async () => {
    const fakeFlagged = [{ id: "e3", flagged: true }];
    vi.mocked(getFlaggedEvents).mockResolvedValue(fakeFlagged as any);

    const supabaseMock = {} as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "actor@example.com" } as any,
      supabase: supabaseMock,
      req: undefined,
    });

    const result = await caller.careEvents.flagged({
      recipientId: RECIPIENT_ID,
    });

    expect(getFlaggedEvents).toHaveBeenCalledWith(supabaseMock, RECIPIENT_ID);
    expect(result).toEqual(fakeFlagged);
  });
});

// ─── careEvents.getOne ────────────────────────────────────────────────────────

describe("careEvents.getOne — return value and error handling", () => {
  it("returns event data from supabase on success", async () => {
    const fakeEvent = {
      id: EVENT_ID,
      event_type: "journal",
      entry_kind: "human",
    };
    const mockSupabase = makeSupabaseMock({ data: fakeEvent, error: null });

    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "actor@example.com" } as any,
      supabase: mockSupabase as any,
      req: undefined,
    });

    const result = await caller.careEvents.getOne({ eventId: EVENT_ID });
    expect(result).toEqual(fakeEvent);
  });

  it("throws NOT_FOUND when event does not exist", async () => {
    const mockSupabase = makeSupabaseMock({ data: null, error: null });

    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "actor@example.com" } as any,
      supabase: mockSupabase as any,
      req: undefined,
    });

    await expect(
      caller.careEvents.getOne({ eventId: EVENT_ID }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
