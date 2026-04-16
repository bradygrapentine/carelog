import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin before importing the repository
vi.mock("../../supabaseAdmin.server", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { autoTagCareEvent } from "../medicationTaggingRepository";
import { supabaseAdmin } from "../../supabaseAdmin.server";

const meds = [
  { id: "med-1", drug_name: "Metformin", brand_name: "Glucophage" },
  { id: "med-2", drug_name: "Lisinopril", brand_name: "Prinivil" },
  { id: "med-3", drug_name: "Atorvastatin", brand_name: "Lipitor" },
];

type CorpusItem = {
  payload: Record<string, unknown>;
  expected: string[];
};

const corpus: CorpusItem[] = [
  // Should match
  { payload: { text: "Gave metformin with breakfast" }, expected: ["med-1"] },
  { payload: { text: "Administered Glucophage 500mg" }, expected: ["med-1"] },
  {
    payload: { text: "Patient took lisinopril this morning" },
    expected: ["med-2"],
  },
  {
    payload: { text: "Forgot Prinivil — administered late" },
    expected: ["med-2"],
  },
  { payload: { text: "atorvastatin given at bedtime" }, expected: ["med-3"] },
  { payload: { text: "Lipitor dose administered" }, expected: ["med-3"] },
  {
    payload: { notes: "Metformin and lisinopril both given" },
    expected: ["med-1", "med-2"],
  },
  {
    payload: { description: "Lipitor taken, also metformin" },
    expected: ["med-1", "med-3"],
  },
  // Should NOT match (unrelated)
  { payload: { text: "Helped with walking exercises" }, expected: [] },
  { payload: { text: "Lunch and dinner eaten well" }, expected: [] },
];

function buildMockFrom(item: CorpusItem) {
  return vi.fn().mockImplementation((table: string) => {
    if (table === "care_events") {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({ data: { payload: item.payload }, error: null }),
          }),
        }),
      };
    }
    if (table === "medications") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: meds, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "care_event_medications") {
      return {
        upsert: () =>
          Promise.resolve({ error: null, count: item.expected.length }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    };
  });
}

describe("autoTagCareEvent — precision test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tags ≥80% of events in a 10-item synthetic corpus", async () => {
    let correct = 0;

    for (const item of corpus) {
      (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from =
        buildMockFrom(item);

      const count = await autoTagCareEvent(
        "event-id",
        "org-id",
        "recipient-id",
      );

      const shouldMatch = item.expected.length > 0;
      const didMatch = count > 0;

      if (shouldMatch === didMatch) correct++;
    }

    const precision = correct / corpus.length;
    expect(precision).toBeGreaterThanOrEqual(0.8);
  });

  it("returns 0 for events with no medication mentions", async () => {
    const item = corpus[8]; // "Helped with walking exercises"
    (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from =
      buildMockFrom(item);

    const count = await autoTagCareEvent("event-id", "org-id", "recipient-id");
    expect(count).toBe(0);
  });

  it("returns >0 for events that mention a medication by brand name", async () => {
    const item = corpus[1]; // "Administered Glucophage 500mg"
    (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from =
      buildMockFrom(item);

    const count = await autoTagCareEvent("event-id", "org-id", "recipient-id");
    expect(count).toBeGreaterThan(0);
  });

  it("returns 0 and does not throw when care_events fetch fails", async () => {
    (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from = vi
      .fn()
      .mockImplementation((table: string) => {
        if (table === "care_events") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: null,
                    error: { message: "not found" },
                  }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      });

    const count = await autoTagCareEvent("bad-id", "org-id", "recipient-id");
    expect(count).toBe(0);
  });
});
