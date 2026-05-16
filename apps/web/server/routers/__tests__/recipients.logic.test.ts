import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
  wrapAdminError: (e: any) => e,
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { appRouter } from "@/server/trpc/router";

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const USER_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const REC_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";

const caller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

function makeSelectChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain, not: () => chain };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeUpdateChain(result: object) {
  const chain: any = { update: () => chain, eq: () => chain };
  // .update().eq().eq() returns a thenable — final await resolves to result
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

const validInput = {
  org_id: ORG_ID,
  recipient_id: REC_ID,
  likes: ["Coffee black", "Cardinals on the feeder"],
  dislikes: ["Loud TV", "Cold food"],
};

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

describe("recipients.updatePreferences", () => {
  it("throws FORBIDDEN when caller has no membership in the org", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      makeSelectChain({ data: null, error: null }),
    );
    await expect(
      caller.recipients.updatePreferences(validInput),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when caller is a caregiver (not coordinator)", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation(() =>
      makeSelectChain({ data: { role: "caregiver" }, error: null }),
    );
    await expect(
      caller.recipients.updatePreferences(validInput),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when recipient does not belong to the org", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      // recipient lookup returns no row
      return makeSelectChain({
        data: null,
        error: { message: "no row" },
      });
    });
    await expect(
      caller.recipients.updatePreferences(validInput),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects pure-whitespace items via zod", async () => {
    await expect(
      caller.recipients.updatePreferences({
        ...validInput,
        likes: ["   "],
      }),
    ).rejects.toThrow();
  });

  it("rejects arrays with more than 50 items", async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `item-${i}`);
    await expect(
      caller.recipients.updatePreferences({
        ...validInput,
        likes: tooMany,
      }),
    ).rejects.toThrow();
  });

  it("rejects items longer than 120 chars", async () => {
    await expect(
      caller.recipients.updatePreferences({
        ...validInput,
        likes: ["x".repeat(121)],
      }),
    ).rejects.toThrow();
  });

  it("happy path: coordinator + valid payload returns echoed values", async () => {
    let callCount = 0;
    const updateSpy = vi.fn();
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      if (callCount === 2)
        return makeSelectChain({
          data: { id: REC_ID },
          error: null,
        });
      // 3rd call: the update
      const chain: any = {
        update: (payload: unknown) => {
          updateSpy(payload);
          return chain;
        },
        eq: () => chain,
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      };
      return chain;
    });

    const result = await caller.recipients.updatePreferences(validInput);
    expect(result).toEqual({
      ok: true,
      likes: validInput.likes,
      dislikes: validInput.dislikes,
    });
    expect(updateSpy).toHaveBeenCalledWith({
      preferences: {
        likes: validInput.likes,
        dislikes: validInput.dislikes,
      },
    });
  });
});
