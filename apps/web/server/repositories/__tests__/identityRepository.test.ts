import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveIdentity,
  createIdentity,
  resolveAndCacheDisplayName,
  parseEmergencyInfo,
  updateEmergencyInfo,
} from "../identityRepository";

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";

const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TOKEN_FOR_ORG_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const RECIPIENT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

type EqCall = { col: string; val: unknown };

function makeSelectChain(result: { data: unknown; error: unknown }) {
  const eqCalls: EqCall[] = [];
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((col: string, val: unknown) => {
    eqCalls.push({ col, val });
    return chain;
  });
  chain.single = vi.fn().mockResolvedValue(result);
  // expose for assertions
  (chain as unknown as { __eqCalls: EqCall[] }).__eqCalls = eqCalls;
  return chain;
}

function makeInsertChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeUpsertChain() {
  const chain: Record<string, unknown> = {};
  chain.upsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
});

describe("resolveIdentity — cross-org boundary (PHI leak guard)", () => {
  it("rejects a valid token when queried with a different org id", async () => {
    // DB returns no row because the (token, org_id) pair doesn't match
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: null,
          error: { message: "no rows returned" },
        }) as never,
    );

    await expect(resolveIdentity(TOKEN_FOR_ORG_A, ORG_B)).rejects.toThrow(
      "Identity resolution failed",
    );
  });

  it("queries identity_vault filtering by BOTH token AND org_id", async () => {
    // Regression guard: if the org_id filter is ever dropped, a token from org A
    // could resolve when queried by anyone in org B. This test pins the contract.
    const chain = makeSelectChain({
      data: { full_name: "Jane Doe", dob: null, contact_info: {} },
      error: null,
    });
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() => chain as never);

    await resolveIdentity(TOKEN_FOR_ORG_A, ORG_A);

    expect(supabaseAdmin.from).toHaveBeenCalledWith("identity_vault");
    const calls = (chain as unknown as { __eqCalls: EqCall[] }).__eqCalls;
    expect(calls).toEqual([
      { col: "token", val: TOKEN_FOR_ORG_A },
      { col: "org_id", val: ORG_A },
    ]);
  });

  it("returns a clean error for a malformed token without leaking PHI", async () => {
    const MALFORMED = "not-a-uuid";

    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: null,
          error: { message: "invalid input syntax for type uuid" },
        }) as never,
    );

    let thrownError: Error | undefined;
    try {
      await resolveIdentity(MALFORMED, ORG_A);
    } catch (e) {
      thrownError = e as Error;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError!.message).toMatch("Identity resolution failed");
    // The error message must not echo back any identity field
    expect(thrownError!.message).not.toMatch(/full_name|dob|contact_info/i);
  });

  it("returns a clean error for an expired token (no row returned)", async () => {
    // Expired tokens are pruned or flagged at the DB level; vault returns no row
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: null,
          error: { message: "expired token" },
        }) as never,
    );

    await expect(resolveIdentity(TOKEN_FOR_ORG_A, ORG_A)).rejects.toThrow(
      "Identity resolution failed",
    );
  });

  it("returns the identity record on a valid (token, org_id) match", async () => {
    const record = {
      full_name: "Jane Doe",
      dob: "1950-01-01",
      contact_info: { phone: "555-0000" },
    };
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () => makeSelectChain({ data: record, error: null }) as never,
    );

    const result = await resolveIdentity(TOKEN_FOR_ORG_A, ORG_A);
    expect(result).toEqual(record);
  });
});

describe("createIdentity", () => {
  it("inserts and returns the new token", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeInsertChain({
          data: { token: TOKEN_FOR_ORG_A },
          error: null,
        }) as never,
    );

    const token = await createIdentity({
      orgId: ORG_A,
      fullName: "Jane Doe",
      dob: "1950-01-01",
    });

    expect(token).toBe(TOKEN_FOR_ORG_A);
    expect(supabaseAdmin.from).toHaveBeenCalledWith("identity_vault");
  });

  it("throws on insert error without leaking PHI in the message", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeInsertChain({
          data: null,
          error: { message: "insert failed" },
        }) as never,
    );

    let err: Error | undefined;
    try {
      await createIdentity({ orgId: ORG_A, fullName: "Jane Doe" });
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeDefined();
    expect(err!.message).toMatch("Identity creation failed");
    expect(err!.message).not.toMatch(/Jane Doe|1950/);
  });
});

describe("resolveAndCacheDisplayName — cache-aside", () => {
  it("returns cached name when cache row is fresh (no vault hit)", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: { full_name: "Cached Name", expires_at: future },
          error: null,
        }) as never,
    );

    const name = await resolveAndCacheDisplayName(
      RECIPIENT_ID,
      ORG_A,
      TOKEN_FOR_ORG_A,
    );

    expect(name).toBe("Cached Name");
    // Only one from() — display_names. No vault read.
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
    expect(supabaseAdmin.from).toHaveBeenCalledWith("display_names");
  });

  it("falls back to vault on cache miss and writes back", async () => {
    const upsertChain = makeUpsertChain();

    vi.mocked(supabaseAdmin.from)
      // 1st call: display_names cache lookup — miss
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: null,
            error: { message: "no rows" },
          }) as never,
      )
      // 2nd call: identity_vault — hit
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: {
              full_name: "Vault Name",
              dob: null,
              contact_info: {},
            },
            error: null,
          }) as never,
      )
      // 3rd call: display_names upsert
      .mockImplementationOnce(() => upsertChain as never);

    const name = await resolveAndCacheDisplayName(
      RECIPIENT_ID,
      ORG_A,
      TOKEN_FOR_ORG_A,
    );

    expect(name).toBe("Vault Name");
    expect(supabaseAdmin.from).toHaveBeenNthCalledWith(1, "display_names");
    expect(supabaseAdmin.from).toHaveBeenNthCalledWith(2, "identity_vault");
    expect(supabaseAdmin.from).toHaveBeenNthCalledWith(3, "display_names");
    expect(upsertChain.upsert).toHaveBeenCalledTimes(1);
  });

  it("falls back to vault when cached row is expired", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const upsertChain = makeUpsertChain();

    vi.mocked(supabaseAdmin.from)
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: { full_name: "Stale Name", expires_at: past },
            error: null,
          }) as never,
      )
      .mockImplementationOnce(
        () =>
          makeSelectChain({
            data: {
              full_name: "Fresh Name",
              dob: null,
              contact_info: {},
            },
            error: null,
          }) as never,
      )
      .mockImplementationOnce(() => upsertChain as never);

    const name = await resolveAndCacheDisplayName(
      RECIPIENT_ID,
      ORG_A,
      TOKEN_FOR_ORG_A,
    );

    expect(name).toBe("Fresh Name");
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(3);
  });
});

describe("parseEmergencyInfo (UX-105)", () => {
  it("parses a fully-populated contact_info blob", () => {
    expect(
      parseEmergencyInfo({
        dnr_status: "DNR — full code declined",
        hospital: "Memorial Cooper",
        primary_contact: {
          name: "Jane Doe",
          relationship: "Daughter",
          phone: "555-0100",
        },
      }),
    ).toEqual({
      dnrStatus: "DNR — full code declined",
      hospital: "Memorial Cooper",
      primaryContact: {
        name: "Jane Doe",
        relationship: "Daughter",
        phone: "555-0100",
      },
    });
  });

  it("returns {} for an empty blob", () => {
    expect(parseEmergencyInfo({})).toEqual({});
  });

  it("omits primary_contact when name is missing/empty", () => {
    expect(
      parseEmergencyInfo({
        primary_contact: { relationship: "Sibling", phone: "555-0101" },
      }),
    ).toEqual({});
    expect(parseEmergencyInfo({ primary_contact: { name: "   " } })).toEqual(
      {},
    );
  });

  it("omits relationship + phone when present but empty/whitespace", () => {
    expect(
      parseEmergencyInfo({
        primary_contact: { name: "Alex", relationship: "", phone: "  " },
      }),
    ).toEqual({ primaryContact: { name: "Alex" } });
  });

  it("ignores wrong-typed values (does NOT throw)", () => {
    expect(
      parseEmergencyInfo({
        dnr_status: 42,
        hospital: null,
        primary_contact: ["not", "an", "object"],
      }),
    ).toEqual({});
  });
});

describe("updateEmergencyInfo — UX-105b", () => {
  const ORG = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const REC = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const TOKEN = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  function makeUpdateChain(result: { error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.update = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(result).then(resolve);
    return chain;
  }

  it("merges patch into existing contact_info, preserving untouched keys", async () => {
    let capturedUpdate: Record<string, unknown> | undefined;
    vi.mocked(supabaseAdmin.from).mockImplementation(((table: string) => {
      if (table === "care_recipients") {
        return makeSelectChain({
          data: { identity_token: TOKEN },
          error: null,
        }) as never;
      }
      if (table === "identity_vault") {
        // First call: select current contact_info
        const callCount = vi.mocked(supabaseAdmin.from).mock.calls.length;
        if (callCount === 2) {
          return makeSelectChain({
            data: {
              contact_info: {
                dnr_status: "Old",
                hospital: "Old Hospital",
                phone_alt: "555-9999", // untouched key
              },
            },
            error: null,
          }) as never;
        }
        // Third call: update
        const updateChain = makeUpdateChain({ error: null });
        updateChain.update = vi.fn((payload: Record<string, unknown>) => {
          capturedUpdate = payload;
          return updateChain;
        });
        return updateChain as never;
      }
      return makeSelectChain({ data: null, error: null }) as never;
    }) as never);

    await updateEmergencyInfo(ORG, REC, {
      dnrStatus: "DNR",
      hospital: "New Hospital",
      primaryContact: { name: "Jane Doe", phone: "+15551234567" },
    });

    expect(capturedUpdate).toBeDefined();
    const newContactInfo = capturedUpdate!.contact_info as Record<
      string,
      unknown
    >;
    // Patched keys
    expect(newContactInfo.dnr_status).toBe("DNR");
    expect(newContactInfo.hospital).toBe("New Hospital");
    expect(newContactInfo.primary_contact).toEqual({
      name: "Jane Doe",
      phone: "+15551234567",
    });
    // Untouched keys survive
    expect(newContactInfo.phone_alt).toBe("555-9999");
  });

  it("clearing a field (empty string) removes it from contact_info", async () => {
    let capturedUpdate: Record<string, unknown> | undefined;
    vi.mocked(supabaseAdmin.from).mockImplementation(((table: string) => {
      if (table === "care_recipients") {
        return makeSelectChain({
          data: { identity_token: TOKEN },
          error: null,
        }) as never;
      }
      const callCount = vi.mocked(supabaseAdmin.from).mock.calls.length;
      if (callCount === 2) {
        return makeSelectChain({
          data: {
            contact_info: {
              dnr_status: "Full code",
              hospital: "Memorial",
            },
          },
          error: null,
        }) as never;
      }
      const updateChain = makeUpdateChain({ error: null });
      updateChain.update = vi.fn((payload: Record<string, unknown>) => {
        capturedUpdate = payload;
        return updateChain;
      });
      return updateChain as never;
    }) as never);

    await updateEmergencyInfo(ORG, REC, {
      dnrStatus: "",
      hospital: undefined, // skip
      primaryContact: null,
    });

    const newContactInfo = capturedUpdate!.contact_info as Record<
      string,
      unknown
    >;
    expect(newContactInfo).not.toHaveProperty("dnr_status");
    expect(newContactInfo.hospital).toBe("Memorial"); // untouched
    expect(newContactInfo).not.toHaveProperty("primary_contact");
  });

  it("throws recipient_not_found when care_recipients lookup misses", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(
      () =>
        makeSelectChain({
          data: null,
          error: { message: "no rows" },
        }) as never,
    );
    await expect(updateEmergencyInfo(ORG, REC, {})).rejects.toThrow(
      "recipient_not_found",
    );
  });
});
