import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi
    .fn()
    .mockReturnValue({ getAll: vi.fn().mockReturnValue([]), set: vi.fn() }),
}));
vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
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
vi.mock("@/server/repositories/medicationTaggingRepository", () => ({
  tagCareEvent: vi.fn(),
  untagCareEvent: vi.fn(),
  listTagsForCareEvent: vi.fn(),
  tagDocument: vi.fn(),
  untagDocument: vi.fn(),
  listTagsForDocument: vi.fn(),
  listEventsForMedication: vi.fn(),
  listDocumentsForMedication: vi.fn(),
  autoTagCareEvent: vi.fn(),
}));

import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import {
  tagCareEvent,
  listTagsForCareEvent,
  tagDocument,
  listEventsForMedication,
  listDocumentsForMedication,
} from "@/server/repositories/medicationTaggingRepository";
import { appRouter } from "@/server/trpc/router";
import type { MedicationTag } from "@carelog/schemas";

const ORG_ID = "18dc6d19-6712-4b26-8797-b4e544e01b84";
const MED_ID = "28dc6d19-6712-4b26-8797-b4e544e01b85";
const EVENT_ID = "38dc6d19-6712-4b26-8797-b4e544e01b86";
const DOC_ID = "48dc6d19-6712-4b26-8797-b4e544e01b87";
const USER_ID = "58dc6d19-6712-4b26-8797-b4e544e01b88";
const TAG_ID = "68dc6d19-6712-4b26-8797-b4e544e01b89";

const authedCaller = appRouter.createCaller({
  user: { id: USER_ID, email: "user@example.com" } as any,
  supabase: { from: vi.fn() } as any,
  req: undefined,
});

function makeCoordinatorChain() {
  const chain: any = { select: () => chain, eq: () => chain };
  chain.single = vi.fn().mockResolvedValue({
    data: { role: "coordinator", accepted_at: "2026-01-01" },
    error: null,
  });
  return chain;
}

function makeNonCoordinatorChain() {
  const chain: any = { select: () => chain, eq: () => chain };
  chain.single = vi.fn().mockResolvedValue({
    data: { role: "caregiver", accepted_at: "2026-01-01" },
    error: null,
  });
  return chain;
}

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  vi.mocked(tagCareEvent).mockReset();
  vi.mocked(listTagsForCareEvent).mockReset();
  vi.mocked(tagDocument).mockReset();
  vi.mocked(listEventsForMedication).mockReset();
  vi.mocked(listDocumentsForMedication).mockReset();
});

// ─── medications.tagEvent ─────────────────────────────────────────────────────

describe("medications.tagEvent — logic", () => {
  it("calls tagCareEvent repository with correct params and returns success", async () => {
    vi.mocked(tagCareEvent).mockResolvedValue(undefined);

    const result = await authedCaller.medications.tagEvent({
      care_event_id: EVENT_ID,
      medication_id: MED_ID,
      org_id: ORG_ID,
    });

    expect(result).toEqual({ success: true });
    expect(vi.mocked(tagCareEvent)).toHaveBeenCalledWith({
      careEventId: EVENT_ID,
      medicationId: MED_ID,
      orgId: ORG_ID,
      confidence: "manual",
      taggedBy: USER_ID,
    });
  });
});

// ─── medications.getTagsForEvent ──────────────────────────────────────────────

describe("medications.getTagsForEvent — logic", () => {
  it("returns medication tags for a care event", async () => {
    const tags: MedicationTag[] = [
      {
        id: TAG_ID,
        medication_id: MED_ID,
        drug_name: "Lisinopril",
        brand_name: null,
        confidence: "manual",
        tagged_by: USER_ID,
        created_at: "2026-04-16T00:00:00Z",
      },
    ];
    vi.mocked(listTagsForCareEvent).mockResolvedValue(tags);

    const result = await authedCaller.medications.getTagsForEvent({
      care_event_id: EVENT_ID,
    });

    expect(result).toEqual(tags);
    expect(vi.mocked(listTagsForCareEvent)).toHaveBeenCalledWith(EVENT_ID);
  });
});

// ─── medications.tagDocument ──────────────────────────────────────────────────

describe("medications.tagDocument — logic", () => {
  it("throws FORBIDDEN when caller is not a coordinator", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue(makeNonCoordinatorChain());

    await expect(
      authedCaller.medications.tagDocument({
        document_id: DOC_ID,
        medication_id: MED_ID,
        org_id: ORG_ID,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(vi.mocked(tagDocument)).not.toHaveBeenCalled();
  });
});

// ─── medications.get ──────────────────────────────────────────────────────────

describe("medications.get — logic", () => {
  const fakeMedication = {
    id: MED_ID,
    org_id: ORG_ID,
    drug_name: "Metformin",
    dosage: "500mg",
    active: true,
  };

  it("returns medication with recentEvents and linkedDocuments", async () => {
    const ctxSupabase = { from: vi.fn() } as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase,
      req: undefined,
    });

    const chain: any = { select: () => chain, eq: () => chain };
    chain.single = vi.fn().mockResolvedValue({
      data: fakeMedication,
      error: null,
    });
    vi.mocked(ctxSupabase.from).mockReturnValue(chain);

    vi.mocked(listEventsForMedication).mockResolvedValue([]);
    vi.mocked(listDocumentsForMedication).mockResolvedValue([]);

    const result = await caller.medications.get({
      medication_id: MED_ID,
      org_id: ORG_ID,
    });

    expect(result).toMatchObject({
      ...fakeMedication,
      recentEvents: [],
      linkedDocuments: [],
    });
  });

  it("throws NOT_FOUND when medication does not exist", async () => {
    const ctxSupabase = { from: vi.fn() } as any;
    const caller = appRouter.createCaller({
      user: { id: USER_ID, email: "user@example.com" } as any,
      supabase: ctxSupabase,
      req: undefined,
    });

    const chain: any = { select: () => chain, eq: () => chain };
    chain.single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });
    vi.mocked(ctxSupabase.from).mockReturnValue(chain);

    await expect(
      caller.medications.get({ medication_id: MED_ID, org_id: ORG_ID }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
