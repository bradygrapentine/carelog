/**
 * CRUD + auto-tagger error-path tests for medicationTaggingRepository.
 *
 * Matching / precision tests (corpus-driven text matching) live in:
 *   medicationTagging.precision.test.ts
 *
 * This file covers:
 *   (a) tagCareEvent  — upsert + ignoreDuplicates no-op
 *   (b) confidence round-trip — "manual" and "auto"
 *   (c) untagCareEvent — delete by tag id
 *   (d) error re-throw — supabase error propagates with original message
 *   (e) autoTagCareEvent silent-failure — returns { tagsCreated: 0 } + warn on supabase error
 *   (f) document variants — tagDocument, untagDocument, listTagsForDocument, autoTagDocument
 *   (g) listEventsForMedication / listDocumentsForMedication filter shapes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin BEFORE importing the repository (matches precision test pattern)
vi.mock("../../supabaseAdmin.server", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import {
  tagCareEvent,
  untagCareEvent,
  listTagsForCareEvent,
  tagDocument,
  untagDocument,
  listTagsForDocument,
  autoTagCareEvent,
  autoTagDocument,
  listEventsForMedication,
  listDocumentsForMedication,
} from "../medicationTaggingRepository";
import { supabaseAdmin } from "../../supabaseAdmin.server";

// ---------------------------------------------------------------------------
// UUIDs — no PII/PHI
// ---------------------------------------------------------------------------
const CARE_EVENT_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const DOCUMENT_ID = "aaaaaaaa-0000-0000-0000-000000000002";
const MEDICATION_ID = "aaaaaaaa-0000-0000-0000-000000000003";
const ORG_ID = "aaaaaaaa-0000-0000-0000-000000000004";
const RECIPIENT_ID = "aaaaaaaa-0000-0000-0000-000000000005";
const TAG_ID = "aaaaaaaa-0000-0000-0000-000000000006";
const ACTOR_ID = "aaaaaaaa-0000-0000-0000-000000000007";

// ---------------------------------------------------------------------------
// Chain builders
// ---------------------------------------------------------------------------

/** Upsert chain: from("table").upsert(rows, opts) → Promise<{error}> */
function makeUpsertChain(error: { message: string } | null) {
  const chain: Record<string, unknown> = {};
  chain.upsert = vi.fn().mockResolvedValue({ error, count: error ? null : 1 });
  return chain;
}

/** Delete chain: from().delete().eq("id", x) → Promise<{error}> */
function makeDeleteChain(error: { message: string } | null) {
  const chain: Record<string, unknown> = {};
  chain.delete = () => chain;
  chain.eq = vi.fn().mockResolvedValue({ error });
  return chain;
}

/** Select chain for listTags* — returns data or error */
function makeSelectListChain(result: {
  data: unknown[] | null;
  error: { message: string } | null;
}) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = vi.fn().mockResolvedValue(result);
  return chain;
}

/** Single-row select chain (for autoTag* care_events / documents fetch) */
function makeSingleChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

/** Medications list chain: select().eq().eq().eq() → Promise<{data,error}>
 *  The source calls .eq three times (org_id, recipient_id, active).
 *  We use mockReturnThis() for the first two and mockResolvedValue for the last.
 */
function makeMedsChainFull(result: {
  data: unknown[] | null;
  error: { message: string } | null;
}) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  const eqFn = vi
    .fn()
    .mockReturnValueOnce(chain) // first .eq(org_id)
    .mockReturnValueOnce(chain) // second .eq(recipient_id)
    .mockResolvedValue(result); // third .eq(active) resolves
  chain.eq = eqFn;
  return chain;
}

/** Cross-reference list chain: from().select().eq().order().limit() → Promise<{data,error}> */
function makeCrossRefChain(result: {
  data: unknown[] | null;
  error: { message: string } | null;
}) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => chain;
  chain.limit = vi.fn().mockResolvedValue(result);
  return chain;
}

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------
// Spy set up once at module level so it persists across all tests
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

beforeEach(() => {
  vi.mocked(supabaseAdmin.from).mockReset();
  warnSpy.mockClear();
});

// ===========================================================================
// (a) tagCareEvent — upsert + ignoreDuplicates no-op
// ===========================================================================
describe("tagCareEvent", () => {
  it("calls upsert with ignoreDuplicates:true on happy path", async () => {
    const upsertChain = makeUpsertChain(null);
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(upsertChain as any);

    await expect(
      tagCareEvent({
        careEventId: CARE_EVENT_ID,
        medicationId: MEDICATION_ID,
        orgId: ORG_ID,
        confidence: "manual",
        taggedBy: ACTOR_ID,
      }),
    ).resolves.toBeUndefined();

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        care_event_id: CARE_EVENT_ID,
        medication_id: MEDICATION_ID,
        confidence: "manual",
      }),
      { ignoreDuplicates: true },
    );
  });

  it("second call (duplicate) also resolves without error", async () => {
    // ignoreDuplicates:true means a duplicate row is silently skipped
    const chain1 = makeUpsertChain(null);
    const chain2 = makeUpsertChain(null);
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(chain1 as any)
      .mockReturnValueOnce(chain2 as any);

    await tagCareEvent({
      careEventId: CARE_EVENT_ID,
      medicationId: MEDICATION_ID,
      orgId: ORG_ID,
      confidence: "manual",
      taggedBy: null,
    });
    await expect(
      tagCareEvent({
        careEventId: CARE_EVENT_ID,
        medicationId: MEDICATION_ID,
        orgId: ORG_ID,
        confidence: "manual",
        taggedBy: null,
      }),
    ).resolves.toBeUndefined(); // no-ops silently
  });
});

// ===========================================================================
// (b) confidence round-trip
// ===========================================================================
describe("confidence round-trip", () => {
  it('stores "manual" confidence', async () => {
    const upsertChain = makeUpsertChain(null);
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(upsertChain as any);

    await tagCareEvent({
      careEventId: CARE_EVENT_ID,
      medicationId: MEDICATION_ID,
      orgId: ORG_ID,
      confidence: "manual",
      taggedBy: ACTOR_ID,
    });

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: "manual" }),
      expect.anything(),
    );
  });

  it('stores "auto" confidence', async () => {
    const upsertChain = makeUpsertChain(null);
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(upsertChain as any);

    await tagCareEvent({
      careEventId: CARE_EVENT_ID,
      medicationId: MEDICATION_ID,
      orgId: ORG_ID,
      confidence: "auto",
      taggedBy: null,
    });

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ confidence: "auto", tagged_by: null }),
      expect.anything(),
    );
  });

  it("listTagsForCareEvent maps confidence correctly from DB row", async () => {
    const fakeRow = {
      id: TAG_ID,
      medication_id: MEDICATION_ID,
      confidence: "auto",
      tagged_by: null,
      created_at: "2026-01-01T00:00:00Z",
      medications: [{ drug_name: "Metformin", brand_name: "Glucophage" }],
    };
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSelectListChain({ data: [fakeRow], error: null }) as any,
    );

    const tags = await listTagsForCareEvent(CARE_EVENT_ID);
    expect(tags).toHaveLength(1);
    expect(tags[0].confidence).toBe("auto");
    expect(tags[0].drug_name).toBe("Metformin");
    expect(tags[0].brand_name).toBe("Glucophage");
  });
});

// ===========================================================================
// (c) untagCareEvent — delete by tag id
// ===========================================================================
describe("untagCareEvent", () => {
  it("calls delete().eq('id', tagId)", async () => {
    const deleteChain = makeDeleteChain(null);
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(deleteChain as any);

    await expect(untagCareEvent(TAG_ID)).resolves.toBeUndefined();

    expect(deleteChain.eq).toHaveBeenCalledWith("id", TAG_ID);
  });
});

// ===========================================================================
// (d) error re-throw — original message preserved
// ===========================================================================
describe("supabase error re-throw", () => {
  it("tagCareEvent re-throws with supabase error message", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeUpsertChain({ message: "unique_violation" }) as any,
    );

    await expect(
      tagCareEvent({
        careEventId: CARE_EVENT_ID,
        medicationId: MEDICATION_ID,
        orgId: ORG_ID,
        confidence: "manual",
        taggedBy: null,
      }),
    ).rejects.toThrow("unique_violation");
  });

  it("untagCareEvent re-throws with supabase error message", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeDeleteChain({ message: "row_not_found" }) as any,
    );

    await expect(untagCareEvent(TAG_ID)).rejects.toThrow("row_not_found");
  });

  it("listTagsForCareEvent re-throws with supabase error message", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSelectListChain({ data: null, error: { message: "permission_denied" } }) as any,
    );

    await expect(listTagsForCareEvent(CARE_EVENT_ID)).rejects.toThrow(
      "permission_denied",
    );
  });
});

// ===========================================================================
// (e) autoTagCareEvent silent-failure (regression-prone surface)
// ===========================================================================
describe("autoTagCareEvent — silent-failure paths", () => {
  it("returns 0 and logs warn when care_events fetch errors", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSingleChain({ data: null, error: { message: "db_timeout" } }) as any,
    );

    const result = await autoTagCareEvent(CARE_EVENT_ID, ORG_ID, RECIPIENT_ID);

    expect(result).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`autoTagCareEvent: failed to fetch care event ${CARE_EVENT_ID}`),
    );
  });

  it("returns 0 and logs warn when medications fetch errors", async () => {
    // First call: care_events succeeds
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSingleChain({
        data: { payload: { text: "metformin given" } },
        error: null,
      }) as any,
    );

    // Second call: medications fails
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeMedsChainFull({ data: null, error: { message: "meds_unavailable" } }) as any,
    );

    const result = await autoTagCareEvent(CARE_EVENT_ID, ORG_ID, RECIPIENT_ID);

    expect(result).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`autoTagCareEvent: failed to fetch medications for org ${ORG_ID}`),
    );
  });

  it("returns 0 and logs warn when upsert errors", async () => {
    const med = { id: MEDICATION_ID, drug_name: "Metformin", brand_name: null };

    // care_events fetch
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSingleChain({
        data: { payload: { text: "gave metformin" } },
        error: null,
      }) as any,
    );

    // medications fetch
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeMedsChainFull({ data: [med], error: null }) as any,
    );

    // upsert fails
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeUpsertChain({ message: "upsert_failed" }) as any,
    );

    const result = await autoTagCareEvent(CARE_EVENT_ID, ORG_ID, RECIPIENT_ID);

    expect(result).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`autoTagCareEvent: upsert failed for event ${CARE_EVENT_ID}`),
    );
  });

  it("returns 0 when no medications match payload", async () => {
    const med = { id: MEDICATION_ID, drug_name: "Metformin", brand_name: null };

    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSingleChain({
        data: { payload: { text: "helped with walking exercises" } },
        error: null,
      }) as any,
    );

    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeMedsChainFull({ data: [med], error: null }) as any,
    );

    const result = await autoTagCareEvent(CARE_EVENT_ID, ORG_ID, RECIPIENT_ID);

    expect(result).toBe(0);
  });
});

// ===========================================================================
// (f) document variants
// ===========================================================================
describe("tagDocument", () => {
  it("upserts to document_medications with ignoreDuplicates:true", async () => {
    const upsertChain = makeUpsertChain(null);
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(upsertChain as any);

    await expect(
      tagDocument({
        documentId: DOCUMENT_ID,
        medicationId: MEDICATION_ID,
        orgId: ORG_ID,
        confidence: "manual",
        taggedBy: ACTOR_ID,
      }),
    ).resolves.toBeUndefined();

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: DOCUMENT_ID,
        medication_id: MEDICATION_ID,
        confidence: "manual",
      }),
      { ignoreDuplicates: true },
    );
  });

  it("re-throws supabase error", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeUpsertChain({ message: "doc_upsert_fail" }) as any,
    );

    await expect(
      tagDocument({
        documentId: DOCUMENT_ID,
        medicationId: MEDICATION_ID,
        orgId: ORG_ID,
        confidence: "auto",
        taggedBy: null,
      }),
    ).rejects.toThrow("doc_upsert_fail");
  });
});

describe("untagDocument", () => {
  it("deletes by tag id", async () => {
    const deleteChain = makeDeleteChain(null);
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(deleteChain as any);

    await expect(untagDocument(TAG_ID)).resolves.toBeUndefined();
    expect(deleteChain.eq).toHaveBeenCalledWith("id", TAG_ID);
  });

  it("re-throws supabase error", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeDeleteChain({ message: "doc_delete_fail" }) as any,
    );

    await expect(untagDocument(TAG_ID)).rejects.toThrow("doc_delete_fail");
  });
});

describe("listTagsForDocument", () => {
  it("maps rows with medications nested", async () => {
    const fakeRow = {
      id: TAG_ID,
      medication_id: MEDICATION_ID,
      confidence: "manual",
      tagged_by: ACTOR_ID,
      created_at: "2026-01-02T00:00:00Z",
      medications: { drug_name: "Lisinopril", brand_name: "Prinivil" },
    };
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSelectListChain({ data: [fakeRow], error: null }) as any,
    );

    const tags = await listTagsForDocument(DOCUMENT_ID);
    expect(tags).toHaveLength(1);
    expect(tags[0].drug_name).toBe("Lisinopril");
    expect(tags[0].confidence).toBe("manual");
  });

  it("returns empty array when no tags", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSelectListChain({ data: [], error: null }) as any,
    );

    const tags = await listTagsForDocument(DOCUMENT_ID);
    expect(tags).toEqual([]);
  });

  it("re-throws supabase error", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSelectListChain({ data: null, error: { message: "doc_list_fail" } }) as any,
    );

    await expect(listTagsForDocument(DOCUMENT_ID)).rejects.toThrow("doc_list_fail");
  });
});

describe("autoTagDocument — silent-failure paths", () => {
  it("returns 0 and logs warn when document fetch errors", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSingleChain({ data: null, error: { message: "doc_timeout" } }) as any,
    );

    const result = await autoTagDocument(DOCUMENT_ID, ORG_ID, RECIPIENT_ID);

    expect(result).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`autoTagDocument: failed to fetch document ${DOCUMENT_ID}`),
    );
  });

  it("returns 0 when no medications match extracted_text", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSingleChain({
        data: { extracted_text: "Annual wellness visit summary" },
        error: null,
      }) as any,
    );

    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeMedsChainFull({
        data: [{ id: MEDICATION_ID, drug_name: "Metformin", brand_name: null }],
        error: null,
      }) as any,
    );

    const result = await autoTagDocument(DOCUMENT_ID, ORG_ID, RECIPIENT_ID);
    expect(result).toBe(0);
  });

  it("returns 0 and logs warn when upsert errors", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeSingleChain({
        data: { extracted_text: "Patient was given metformin daily" },
        error: null,
      }) as any,
    );

    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeMedsChainFull({
        data: [{ id: MEDICATION_ID, drug_name: "Metformin", brand_name: null }],
        error: null,
      }) as any,
    );

    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeUpsertChain({ message: "doc_upsert_err" }) as any,
    );

    const result = await autoTagDocument(DOCUMENT_ID, ORG_ID, RECIPIENT_ID);
    expect(result).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`autoTagDocument: upsert failed for document ${DOCUMENT_ID}`),
    );
  });
});

// ===========================================================================
// (g) listEventsForMedication / listDocumentsForMedication filter shapes
// ===========================================================================
describe("listEventsForMedication", () => {
  it("filters by medication_id and applies default limit=5", async () => {
    const fakeRow = {
      care_events: {
        id: CARE_EVENT_ID,
        occurred_at: "2026-01-01T10:00:00Z",
        event_type: "journal",
        payload: { text: "given meds" },
      },
    };
    const limitFn = vi.fn().mockResolvedValue({ data: [fakeRow], error: null });
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = () => chain;
    chain.limit = limitFn;
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(chain as any);

    const events = await listEventsForMedication(MEDICATION_ID);
    expect(limitFn).toHaveBeenCalledWith(5);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(CARE_EVENT_ID);
  });

  it("respects custom limit parameter", async () => {
    const limitFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = () => chain;
    chain.limit = limitFn;
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(chain as any);

    await listEventsForMedication(MEDICATION_ID, 10);
    expect(limitFn).toHaveBeenCalledWith(10);
  });

  it("re-throws supabase error", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeCrossRefChain({ data: null, error: { message: "events_fail" } }) as any,
    );

    await expect(listEventsForMedication(MEDICATION_ID)).rejects.toThrow("events_fail");
  });
});

describe("listDocumentsForMedication", () => {
  it("filters by medication_id and applies default limit=200", async () => {
    const fakeRow = {
      documents: {
        id: DOCUMENT_ID,
        display_name: "Lab results Q1",
        doc_type: "lab",
        created_at: "2026-01-01T00:00:00Z",
      },
    };
    const limitFn = vi.fn().mockResolvedValue({ data: [fakeRow], error: null });
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = () => chain;
    chain.limit = limitFn;
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(chain as any);

    const docs = await listDocumentsForMedication(MEDICATION_ID);
    expect(limitFn).toHaveBeenCalledWith(200);
    expect(docs).toHaveLength(1);
    expect(docs[0].display_name).toBe("Lab results Q1");
  });

  it("respects custom limit parameter", async () => {
    const limitFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = () => chain;
    chain.limit = limitFn;
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(chain as any);

    await listDocumentsForMedication(MEDICATION_ID, 50);
    expect(limitFn).toHaveBeenCalledWith(50);
  });

  it("re-throws supabase error", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      makeCrossRefChain({ data: null, error: { message: "docs_fail" } }) as any,
    );

    await expect(listDocumentsForMedication(MEDICATION_ID)).rejects.toThrow("docs_fail");
  });
});
