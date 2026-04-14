import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } },
}));
vi.mock("@/server/repositories/membershipsRepository", () => ({
  getMemberships: vi.fn(),
  createMembershipAndInvite: vi.fn(),
}));
vi.mock("@/server/repositories/careEventsRepository", () => ({
  getTimeline: vi.fn(),
  insertEvent: vi.fn(),
  getFlaggedEvents: vi.fn(),
  insertEventIdempotent: vi.fn(),
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
import { appRouter } from "@/server/trpc/router";

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const USER_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const REC_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";
const DOC_ID = "58dc6d19-6712-4b26-8797-b4e544e01b88";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

function makeSelectChain(result: object) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    order: () => chain,
  };
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function makeListChain(result: object) {
  const chain: any = { select: () => chain, eq: () => chain, not: () => chain };
  chain.order = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(supabaseAdmin.storage.from).mockReset();
});

// ─── documents.list — business logic ─────────────────────────────────────────

describe("documents.list — business logic", () => {
  const sampleDocs = [
    {
      id: DOC_ID,
      display_name: "POA.pdf",
      doc_type: "poa",
      file_size: 102400,
      uploaded_by: USER_ID,
      created_at: "2026-04-09T00:00:00Z",
    },
  ];

  it("returns documents for the given recipient", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeListChain({ data: sampleDocs, error: null });
    });

    const result = await authedCaller.documents.list({
      org_id: ORG_ID,
      recipient_id: REC_ID,
    });
    expect(result).toEqual(
      sampleDocs.map((d) => ({ ...d, match_snippet: null })),
    );
  });

  it("returns empty array when no documents exist", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "caregiver" }, error: null });
      return makeListChain({ data: null, error: null });
    });

    const result = await authedCaller.documents.list({
      org_id: ORG_ID,
      recipient_id: REC_ID,
    });
    expect(result).toEqual([]);
  });

  it("throws INTERNAL_SERVER_ERROR when DB read fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "caregiver" }, error: null });
      return makeListChain({ data: null, error: { message: "db error" } });
    });

    await expect(
      authedCaller.documents.list({ org_id: ORG_ID, recipient_id: REC_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── documents.delete — business logic ───────────────────────────────────────

describe("documents.delete — business logic", () => {
  const storagePath = "org-1/rec-1/doc.pdf";

  it("deletes storage object before removing DB row", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      if (callCount === 2)
        return makeSelectChain({
          data: { storage_path: storagePath },
          error: null,
        });
      // delete chain
      const delChain: any = {};
      let eqCalls = 0;
      delChain.delete = () => delChain;
      delChain.eq = () => {
        eqCalls++;
        return eqCalls >= 2 ? Promise.resolve({ error: null }) : delChain;
      };
      return delChain;
    });

    const removeStub = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      remove: removeStub,
    } as any);

    const result = await authedCaller.documents.delete({
      id: DOC_ID,
      org_id: ORG_ID,
    });
    expect(result).toEqual({ ok: true });
    expect(removeStub).toHaveBeenCalledWith([storagePath]);
    expect(vi.mocked(supabaseAdmin.storage.from)).toHaveBeenCalledWith(
      "care-documents",
    );
  });

  it("throws NOT_FOUND when doc fetch returns no data", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      return makeSelectChain({
        data: null,
        error: { code: "PGRST116", message: "not found" },
      });
    });

    await expect(
      authedCaller.documents.delete({ id: DOC_ID, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws INTERNAL_SERVER_ERROR when DB delete fails", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      if (callCount === 2)
        return makeSelectChain({
          data: { storage_path: storagePath },
          error: null,
        });
      // delete chain that errors
      const delChain: any = {};
      let eqCalls = 0;
      delChain.delete = () => delChain;
      delChain.eq = () => {
        eqCalls++;
        return eqCalls >= 2
          ? Promise.resolve({ error: { message: "delete error" } })
          : delChain;
      };
      return delChain;
    });

    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({
      remove: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    await expect(
      authedCaller.documents.delete({ id: DOC_ID, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
