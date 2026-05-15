import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  acceptInvite,
  getCareTeamForRecipient,
} from "../membershipsRepository";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    auth: { admin: { getUserById: vi.fn() } },
  },
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const INVITE_ID = "11111111-1111-1111-1111-111111111111";
const MEMBERSHIP_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "33333333-3333-3333-3333-333333333333";
const USER_EMAIL = "user@test.com";
const VALID_TOKEN = "a".repeat(64);

function futureDate() {
  return new Date(Date.now() + 86_400_000).toISOString();
}

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.update = () => chain;
  chain.eq = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(resolve);
  return chain;
}

function validInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: INVITE_ID,
    membership_id: MEMBERSHIP_ID,
    email: USER_EMAIL,
    expires_at: futureDate(),
    consumed_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(supabaseAdmin.auth.admin.getUserById).mockReset();
});

describe("acceptInvite state machine", () => {
  it('throws "Invalid invite token" when no invite is found', async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({ data: null, error: { message: "not found" } }) as any,
    );

    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: USER_EMAIL }),
    ).rejects.toThrow("Invalid invite token");
  });

  it("throws when the token has already been consumed", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: validInvite({ consumed_at: new Date().toISOString() }),
          error: null,
        }) as any,
    );

    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: USER_EMAIL }),
    ).rejects.toThrow("This invite has already been used");
  });

  it("throws when the token has expired", async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: validInvite({ expires_at: pastDate }),
          error: null,
        }) as any,
    );

    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: USER_EMAIL }),
    ).rejects.toThrow("This invite has expired");
  });

  it("throws when the accepting user email does not match", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: validInvite({ email: "other@test.com" }),
          error: null,
        }) as any,
    );

    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: USER_EMAIL }),
    ).rejects.toThrow("This invite was sent to a different email address");
  });

  it("accepts when invite email has different casing than accepting user", async () => {
    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: validInvite({ email: "user@test.com" }),
            error: null,
          }) as any,
      )
      .mockImplementation(() => makeUpdateChain() as any);

    // Accepting with uppercase — repository lowercases the incoming email
    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: "USER@TEST.COM" }),
    ).resolves.toBeUndefined();
  });

  it("resolves and fires both updates on the happy path", async () => {
    const updateChain = makeUpdateChain();
    const updateSpy = vi.fn(() => updateChain);

    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () => makeSelectChain({ data: validInvite(), error: null }) as any,
      )
      .mockImplementation(updateSpy as any);

    await expect(
      acceptInvite(VALID_TOKEN, { id: USER_ID, email: USER_EMAIL }),
    ).resolves.toBeUndefined();

    // Promise.all fires two from() calls — one for each update
    expect(updateSpy).toHaveBeenCalledTimes(2);
  });
});

describe("getCareTeamForRecipient", () => {
  const ORG_ID = "44444444-4444-4444-4444-444444444444";
  const RECIPIENT_ID = "55555555-5555-5555-5555-555555555555";
  const M1 = "66666666-6666-6666-6666-666666666666";
  const M2 = "77777777-7777-7777-7777-777777777777";
  const U1 = "88888888-8888-8888-8888-888888888888";
  const U2 = "99999999-9999-9999-9999-999999999999";

  function makeListChain(result: { data: unknown; error: unknown }) {
    // TD-122: thenable mock (mirrors `makeUpdateChain` at line 34 and the
    // Supabase client's actual PromiseLike contract). Resolution is decoupled
    // from filter-call shape — adding a 3rd `.not()` filter (e.g. soft-delete)
    // no longer silently stalls the mock. All filters are vi.fn so call-site
    // tests can still assert filter contracts directly (e.g. toHaveBeenCalledWith).
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.or = vi.fn(() => chain);
    chain.not = vi.fn(() => chain);
    chain.then = (resolve: (v: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve);
    return chain;
  }

  it("returns members with names resolved from auth.users.user_metadata.display_name", async () => {
    const chain = makeListChain({
      data: [
        { id: M1, user_id: U1, role: "coordinator", recipient_id: null },
        {
          id: M2,
          user_id: U2,
          role: "caregiver",
          recipient_id: RECIPIENT_ID,
        },
      ],
      error: null,
    });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      chain as unknown as never,
    );
    vi.mocked(supabaseAdmin.auth.admin.getUserById)
      .mockResolvedValueOnce({
        data: {
          user: { id: U1, user_metadata: { display_name: "Alice Adams" } },
        },
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: {
          user: { id: U2, user_metadata: { display_name: "Bob Brown" } },
        },
        error: null,
      } as never);

    const result = await getCareTeamForRecipient(ORG_ID, RECIPIENT_ID);
    expect(result).toEqual([
      { id: M1, name: "Alice Adams", role: "coordinator", initials: "AA" },
      { id: M2, name: "Bob Brown", role: "caregiver", initials: "BB" },
    ]);

    // TD-140: lock the prod query shape. .select column-list intentionally
    // matched with stringContaining so a future additive column doesn't break
    // this test. .not() asserts deferred — called twice with different args.
    expect(chain.select).toHaveBeenCalledWith(
      expect.stringContaining("user_id"),
    );
    expect(chain.eq).toHaveBeenCalledWith("org_id", ORG_ID);
    expect(chain.or).toHaveBeenCalledWith(
      `recipient_id.eq.${RECIPIENT_ID},recipient_id.is.null`,
    );
  });

  it("falls back to user_metadata.full_name when display_name absent", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeListChain({
        data: [{ id: M1, user_id: U1, role: "caregiver", recipient_id: null }],
        error: null,
      }) as unknown as never,
    );
    vi.mocked(supabaseAdmin.auth.admin.getUserById).mockResolvedValueOnce({
      data: { user: { id: U1, user_metadata: { full_name: "Carl Carter" } } },
      error: null,
    } as never);

    const result = await getCareTeamForRecipient(ORG_ID, RECIPIENT_ID);
    expect(result[0]?.name).toBe("Carl Carter");
    expect(result[0]?.initials).toBe("CC");
  });

  it("falls back to 'Member' when user_metadata is empty", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeListChain({
        data: [{ id: M1, user_id: U1, role: "supporter", recipient_id: null }],
        error: null,
      }) as unknown as never,
    );
    vi.mocked(supabaseAdmin.auth.admin.getUserById).mockResolvedValueOnce({
      data: { user: { id: U1, user_metadata: {} } },
      error: null,
    } as never);

    const result = await getCareTeamForRecipient(ORG_ID, RECIPIENT_ID);
    expect(result[0]?.name).toBe("Member");
    expect(result[0]?.initials).toBe("M");
  });

  it("returns empty array when no memberships match", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeListChain({ data: [], error: null }) as unknown as never,
    );
    const result = await getCareTeamForRecipient(ORG_ID, RECIPIENT_ID);
    expect(result).toEqual([]);
    expect(supabaseAdmin.auth.admin.getUserById).not.toHaveBeenCalled();
  });

  it("throws when the memberships query errors", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeListChain({
        data: null,
        error: { message: "boom" },
      }) as unknown as never,
    );
    await expect(getCareTeamForRecipient(ORG_ID, RECIPIENT_ID)).rejects.toThrow(
      /getCareTeamForRecipient failed: boom/,
    );
  });
});
