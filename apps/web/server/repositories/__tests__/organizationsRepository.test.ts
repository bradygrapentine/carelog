import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getOrganization,
  getUserOrganizations,
  createOrganization,
} from "../organizationsRepository";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

type EqCall = { col: string; val: unknown };

function makeChain(opts: {
  result: { data: unknown; error: unknown };
  notSpec?: { col: string; op: string; val: unknown };
}) {
  const eqCalls: EqCall[] = [];
  let notCalled: { col: string; op: string; val: unknown } | null = null;
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.eq = vi.fn((col: string, val: unknown) => {
    eqCalls.push({ col, val });
    return chain;
  });
  chain.not = vi.fn((col: string, op: string, val: unknown) => {
    notCalled = { col, op, val };
    return chain;
  });
  chain.single = vi.fn().mockResolvedValue(opts.result);
  // For non-.single() terminal awaits (getUserOrganizations), the chain itself
  // resolves to result via .then.
  chain.then = ((
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise.resolve(opts.result).then(onFulfilled, onRejected)) as unknown;
  return {
    chain,
    inspect: () => ({ eqCalls, notCalled }),
  };
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

describe("getOrganization", () => {
  it("scopes the query by id (single-org SELECT)", async () => {
    const { chain, inspect } = makeChain({
      result: { data: { id: ORG_A, name: "Org A" }, error: null },
    });
    const supabase = {
      from: vi.fn(() => chain),
    } as unknown as SupabaseClient;

    const org = await getOrganization(supabase, ORG_A);

    expect(org).toEqual({ id: ORG_A, name: "Org A" });
    expect(supabase.from).toHaveBeenCalledWith("organizations");
    const { eqCalls } = inspect();
    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0]).toEqual({ col: "id", val: ORG_A });
  });

  it("returns null on error rather than leaking the underlying message", async () => {
    const { chain } = makeChain({
      result: { data: null, error: { message: "no rows" } },
    });
    const supabase = {
      from: vi.fn(() => chain),
    } as unknown as SupabaseClient;

    const org = await getOrganization(supabase, ORG_B);
    expect(org).toBeNull();
  });
});

describe("getUserOrganizations cross-org isolation", () => {
  it("filters memberships by user_id (cannot enumerate other users' orgs)", async () => {
    const { chain, inspect } = makeChain({
      result: {
        data: [{ organizations: { id: ORG_A, name: "Org A" } }],
        error: null,
      },
    });
    const supabase = {
      from: vi.fn(() => chain),
    } as unknown as SupabaseClient;

    const orgs = await getUserOrganizations(supabase, USER_A);

    expect(orgs).toEqual([{ id: ORG_A, name: "Org A" }]);
    expect(supabase.from).toHaveBeenCalledWith("memberships");

    const { eqCalls, notCalled } = inspect();
    // Critical: the eq filter MUST scope by user_id. If a refactor drops it,
    // RLS becomes the only line of defense; this test catches the regression
    // at the repo layer.
    const userIdEq = eqCalls.find((c) => c.col === "user_id");
    expect(userIdEq).toBeDefined();
    expect(userIdEq!.val).toBe(USER_A);

    // accepted_at NOT NULL — pending invitations don't grant org visibility.
    expect(notCalled).toEqual({
      col: "accepted_at",
      op: "is",
      val: null,
    });
  });

  it("returns user A's orgs only — never user B's, even if user B has more orgs", async () => {
    // The DB-layer fixture: when query runs with user_id = A, only A's row
    // comes back. The repo must pass user_id = A (verified above) so the
    // result set is correctly scoped.
    const { chain } = makeChain({
      result: {
        data: [{ organizations: { id: ORG_A, name: "Org A" } }],
        error: null,
      },
    });
    const supabase = {
      from: vi.fn(() => chain),
    } as unknown as SupabaseClient;

    const orgs = await getUserOrganizations(supabase, USER_A);
    const ids = orgs.map((o) => o.id);
    expect(ids).toContain(ORG_A);
    expect(ids).not.toContain(ORG_B);
  });

  it("excludes pending (un-accepted) memberships", async () => {
    // Simulate DB filtering: accepted_at IS NULL rows are excluded by the
    // .not("accepted_at", "is", null) filter, so the data array is empty.
    const { chain } = makeChain({
      result: { data: [], error: null },
    });
    const supabase = {
      from: vi.fn(() => chain),
    } as unknown as SupabaseClient;

    const orgs = await getUserOrganizations(supabase, USER_B);
    expect(orgs).toEqual([]);
  });

  it("filters out membership rows whose join returned no organization", async () => {
    // Defense-in-depth against a deleted org leaving a dangling membership row.
    const { chain } = makeChain({
      result: {
        data: [
          { organizations: { id: ORG_A, name: "Org A" } },
          { organizations: null },
        ],
        error: null,
      },
    });
    const supabase = {
      from: vi.fn(() => chain),
    } as unknown as SupabaseClient;

    const orgs = await getUserOrganizations(supabase, USER_A);
    expect(orgs).toHaveLength(1);
    expect(orgs[0]!.id).toBe(ORG_A);
  });

  it("throws a clean error without leaking PHI on DB failure", async () => {
    const { chain } = makeChain({
      result: {
        data: null,
        error: { message: "permission denied for memberships" },
      },
    });
    const supabase = {
      from: vi.fn(() => chain),
    } as unknown as SupabaseClient;

    let err: Error | undefined;
    try {
      await getUserOrganizations(supabase, USER_A);
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/Org fetch failed/);
    // Surface message is allowed but no identity / membership row data should
    // leak through. The error wrapper passes through the DB message verbatim
    // here — this test pins that contract so a future refactor doesn't widen
    // the error to include row data.
    expect(err!.message).not.toMatch(/full_name|email|user_id|org_id/i);
  });
});

describe("createOrganization", () => {
  it("inserts via admin with name, org_type, and default plan='free'", async () => {
    const insertedRow = {
      id: ORG_A,
      name: "New Org",
      org_type: "family",
      plan: "free",
    };

    const insertSpy = vi.fn();
    const { chain } = makeChain({ result: { data: insertedRow, error: null } });
    chain.insert = vi.fn((row: unknown) => {
      insertSpy(row);
      return chain;
    });

    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() => chain as any);

    const org = await createOrganization({
      name: "New Org",
      orgType: "family",
    });

    expect(org.id).toBe(ORG_A);
    expect(supabaseAdmin.from).toHaveBeenCalledWith("organizations");
    expect(insertSpy).toHaveBeenCalledWith({
      name: "New Org",
      org_type: "family",
      plan: "free",
    });
  });

  it("returns a row whose id is a non-empty UUID assigned by the DB", async () => {
    // Pins the contract: the repo trusts the DB to assign org_id and surfaces
    // it. If a refactor accidentally generates the id client-side without
    // forwarding it, this test catches the missing/empty id.
    const insertedRow = {
      id: ORG_B,
      name: "Another Org",
      org_type: "facility",
      plan: "free",
    };
    const { chain } = makeChain({ result: { data: insertedRow, error: null } });
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() => chain as any);

    const org = await createOrganization({
      name: "Another Org",
      orgType: "facility",
    });

    expect(org.id).toBe(ORG_B);
    expect(typeof org.id).toBe("string");
    expect(org.id.length).toBeGreaterThan(0);
  });

  it("throws when the DB rejects the insert", async () => {
    const { chain } = makeChain({
      result: { data: null, error: { message: "duplicate key" } },
    });
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() => chain as any);

    await expect(
      createOrganization({ name: "Dup", orgType: "family" }),
    ).rejects.toThrow(/Org creation failed/);
  });

  it("throws when the DB returns no row even without an explicit error", async () => {
    const { chain } = makeChain({ result: { data: null, error: null } });
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() => chain as any);

    await expect(
      createOrganization({ name: "Ghost", orgType: "family" }),
    ).rejects.toThrow(/Org creation failed/);
  });
});
