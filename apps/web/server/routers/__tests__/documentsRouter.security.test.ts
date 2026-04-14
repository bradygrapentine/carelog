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

const anonCaller = appRouter.createCaller({
  user: null,
  supabase: {} as any,
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

// ─── documents.list ───────────────────────────────────────────────────────────

describe("documents.list — authentication", () => {
  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(
      anonCaller.documents.list({ org_id: ORG_ID, recipient_id: REC_ID }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("documents.list — authorization", () => {
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

  it("returns documents for any authenticated org member", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "caregiver" }, error: null });
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

  it("throws FORBIDDEN when caller is not an org member", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: null }),
    );

    const OTHER_ORG = "99dc6d19-6712-4b26-8797-b4e544e01b99";
    await expect(
      authedCaller.documents.list({ org_id: OTHER_ORG, recipient_id: REC_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("supporter role can list documents", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return makeSelectChain({ data: { role: "supporter" }, error: null });
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
});

// ─── documents.delete ─────────────────────────────────────────────────────────

describe("documents.delete — authentication", () => {
  it("throws UNAUTHORIZED when no user in context", async () => {
    await expect(
      anonCaller.documents.delete({ id: DOC_ID, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("documents.delete — authorization", () => {
  it("throws FORBIDDEN when role is caregiver", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: "caregiver" }, error: null }),
    );

    await expect(
      authedCaller.documents.delete({ id: DOC_ID, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when role is supporter", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: { role: "supporter" }, error: null }),
    );

    await expect(
      authedCaller.documents.delete({ id: DOC_ID, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when caller is not an org member", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      makeSelectChain({ data: null, error: null }),
    );

    const OTHER_ORG = "99dc6d19-6712-4b26-8797-b4e544e01b99";
    await expect(
      authedCaller.documents.delete({ id: DOC_ID, org_id: OTHER_ORG }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws NOT_FOUND when doc does not belong to org", async () => {
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      // First: membership check → coordinator
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      // Second: doc lookup → not found
      return makeSelectChain({
        data: null,
        error: { code: "PGRST116", message: "not found" },
      });
    });

    await expect(
      authedCaller.documents.delete({ id: DOC_ID, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deletes storage object and DB row when coordinator", async () => {
    const storagePath = "org-1/rec-1/doc.pdf";
    let callCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      callCount++;
      // First: membership check → coordinator
      if (callCount === 1)
        return makeSelectChain({ data: { role: "coordinator" }, error: null });
      // Second: doc fetch → returns storage_path
      if (callCount === 2)
        return makeSelectChain({
          data: { storage_path: storagePath },
          error: null,
        });
      // Third: delete → success
      const delChain: any = {};
      delChain.delete = () => delChain;
      delChain.eq = () => delChain;
      // final .eq() call resolves to success
      let eqCalls = 0;
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
  });
});
