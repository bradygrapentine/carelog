// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

import { appRouter } from "@/server/trpc/router";
import type { Context } from "@/server/trpc";

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const USER_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const RECIPIENT_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const BRIEF_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

type Chain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function makeChain(result: { data: unknown; error: unknown }): Chain {
  const chain = {} as Chain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeCaller(chain: Chain) {
  const ctxSupabase = {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as Context["supabase"];
  const caller = appRouter.createCaller({
    user: { id: USER_ID, email: "user@example.com" } as Context["user"],
    supabase: ctxSupabase,
    req: undefined,
  } as Context);
  return { caller, ctxSupabase };
}

describe("briefs.latestForRecipient — logic", () => {
  it("returns the most-recent non-revoked brief for the (recipient, org) pair", async () => {
    const brief = {
      id: BRIEF_ID,
      title: "Today's brief",
      content: "Mom slept poorly. Three med doses missed.",
      includes: ["mood", "meds"],
      created_at: "2026-04-29T07:02:00Z",
    };
    const chain = makeChain({ data: brief, error: null });
    const { caller, ctxSupabase } = makeCaller(chain);

    const result = await caller.briefs.latestForRecipient({
      recipientId: RECIPIENT_ID,
      orgId: ORG_ID,
    });

    expect(result).toEqual(brief);
    expect(ctxSupabase.from).toHaveBeenCalledWith("care_briefs");
    expect(chain.eq).toHaveBeenCalledWith("recipient_id", RECIPIENT_ID);
    expect(chain.eq).toHaveBeenCalledWith("org_id", ORG_ID);
    expect(chain.eq).toHaveBeenCalledWith("revoked", false);
    expect(chain.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when no brief exists yet (caller renders empty state)", async () => {
    const chain = makeChain({ data: null, error: null });
    const { caller } = makeCaller(chain);

    const result = await caller.briefs.latestForRecipient({
      recipientId: RECIPIENT_ID,
      orgId: ORG_ID,
    });

    expect(result).toBeNull();
  });

  it("throws INTERNAL_SERVER_ERROR when Supabase returns an error", async () => {
    const chain = makeChain({
      data: null,
      error: { message: "connection lost" },
    });
    const { caller } = makeCaller(chain);

    await expect(
      caller.briefs.latestForRecipient({
        recipientId: RECIPIENT_ID,
        orgId: ORG_ID,
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "connection lost",
    });
  });

  it("rejects non-uuid input via Zod before hitting the database", async () => {
    const chain = makeChain({ data: null, error: null });
    const { caller, ctxSupabase } = makeCaller(chain);

    await expect(
      caller.briefs.latestForRecipient({
        recipientId: "not-a-uuid",
        orgId: ORG_ID,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(ctxSupabase.from).not.toHaveBeenCalled();
  });
});
