import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));

import { appRouter } from "@/server/trpc/router";
import type { Context } from "@/server/trpc";

const ORG_ID = "11020000-0000-0000-0000-000000000001";
const REC_ID = "21020000-0000-0000-0000-000000000001";
const USER_ID = "bbbb1102-0000-0000-0000-000000000002";
const Q_ID = "31020000-0000-0000-0000-000000000099";

function makeContextSupabase(builder: Record<string, unknown>) {
  return {
    from: vi.fn().mockReturnValue(builder),
  } as unknown as Context["supabase"];
}

function caller(supabase: Context["supabase"]) {
  return appRouter.createCaller({
    user: { id: USER_ID, email: "u@example.com" } as Context["user"],
    supabase,
    req: undefined,
  } as Context);
}

describe("shiftQuestions.list — UX-102b", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns rows ordered by raised_at DESC", async () => {
    const rows = [
      {
        id: Q_ID,
        org_id: ORG_ID,
        recipient_id: REC_ID,
        body: "?",
        raised_by: USER_ID,
        raised_at: "2026-05-09T00:00:00Z",
        resolved_at: null,
        resolved_by: null,
      },
    ];
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      is: vi.fn().mockReturnThis(),
    };
    const supabase = makeContextSupabase(chain);
    const result = await caller(supabase).shiftQuestions.list({
      recipientId: REC_ID,
    });
    expect(result).toEqual(rows);
    expect(chain.eq).toHaveBeenCalledWith("recipient_id", REC_ID);
    expect(chain.is).not.toHaveBeenCalled();
  });

  it("filters to open-only when requested", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const supabase = makeContextSupabase(chain);
    await caller(supabase).shiftQuestions.list({
      recipientId: REC_ID,
      openOnly: true,
    });
    expect(chain.is).toHaveBeenCalledWith("resolved_at", null);
  });

  it("rejects non-uuid recipientId via Zod", async () => {
    const chain = { select: vi.fn().mockReturnThis() };
    const supabase = makeContextSupabase(chain);
    await expect(
      caller(supabase).shiftQuestions.list({ recipientId: "nope" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("shiftQuestions.create — UX-102b", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts with raised_by = ctx.user.id", async () => {
    const inserted = {
      id: Q_ID,
      org_id: ORG_ID,
      recipient_id: REC_ID,
      body: "Did dinner go OK?",
      raised_by: USER_ID,
      raised_at: "2026-05-09T00:00:00Z",
      resolved_at: null,
      resolved_by: null,
    };
    const insertSpy = vi.fn().mockReturnThis();
    const chain = {
      insert: insertSpy,
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
    };
    const supabase = makeContextSupabase(chain);
    const result = await caller(supabase).shiftQuestions.create({
      orgId: ORG_ID,
      recipientId: REC_ID,
      body: "Did dinner go OK?",
    });
    expect(result).toEqual(inserted);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ raised_by: USER_ID }),
    );
  });

  it("translates RLS rejection (42501) to FORBIDDEN", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "42501", message: "rls denied" },
      }),
    };
    const supabase = makeContextSupabase(chain);
    await expect(
      caller(supabase).shiftQuestions.create({
        orgId: ORG_ID,
        recipientId: REC_ID,
        body: "x",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects empty body via Zod", async () => {
    const chain = { insert: vi.fn().mockReturnThis() };
    const supabase = makeContextSupabase(chain);
    await expect(
      caller(supabase).shiftQuestions.create({
        orgId: ORG_ID,
        recipientId: REC_ID,
        body: "",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects body over 2000 chars via Zod", async () => {
    const chain = { insert: vi.fn().mockReturnThis() };
    const supabase = makeContextSupabase(chain);
    await expect(
      caller(supabase).shiftQuestions.create({
        orgId: ORG_ID,
        recipientId: REC_ID,
        body: "x".repeat(2001),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("shiftQuestions.resolve — UX-102b", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets resolved_at + resolved_by atomically and only when still open", async () => {
    const resolved = {
      id: Q_ID,
      org_id: ORG_ID,
      recipient_id: REC_ID,
      body: "?",
      raised_by: USER_ID,
      raised_at: "2026-05-09T00:00:00Z",
      resolved_at: "2026-05-09T01:00:00Z",
      resolved_by: USER_ID,
    };
    const updateSpy = vi.fn().mockReturnThis();
    const isSpy = vi.fn().mockReturnThis();
    const chain = {
      update: updateSpy,
      eq: vi.fn().mockReturnThis(),
      is: isSpy,
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: resolved, error: null }),
    };
    const supabase = makeContextSupabase(chain);
    const result = await caller(supabase).shiftQuestions.resolve({ id: Q_ID });
    expect(result).toEqual(resolved);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ resolved_by: USER_ID }),
    );
    // Guard against double-resolve race: must filter resolved_at IS NULL
    expect(isSpy).toHaveBeenCalledWith("resolved_at", null);
  });

  it("throws NOT_FOUND when row already resolved or not visible (RLS)", async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const supabase = makeContextSupabase(chain);
    await expect(
      caller(supabase).shiftQuestions.resolve({ id: Q_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects non-uuid id via Zod", async () => {
    const chain = { update: vi.fn().mockReturnThis() };
    const supabase = makeContextSupabase(chain);
    await expect(
      caller(supabase).shiftQuestions.resolve({ id: "nope" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
