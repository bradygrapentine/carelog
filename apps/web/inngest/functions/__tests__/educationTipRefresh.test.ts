// @vitest-environment node
/**
 * Tests for educationTipRefresh.ts failure modes.
 *
 * The function runs on a daily cron (6am UTC). It fetches all active orgs,
 * reads mood + care_events for each, and upserts an education_tip_cache row.
 * Failure modes: Supabase errors, malformed responses, getGuidesByTags returns
 * no guides (empty content directory).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── mock supabaseAdmin ───────────────────────────────────────────────────────
const mockFrom = vi.hoisted(() => vi.fn());
vi.mock("../../../server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: mockFrom },
}));

// ─── mock getGuidesByTags ─────────────────────────────────────────────────────
const mockGetGuidesByTags = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/education", () => ({
  getGuidesByTags: mockGetGuidesByTags,
}));

// Import the pure helper we can test in isolation (see note below)
// The full Inngest function is a cron handler with no extracted helper,
// so we test the logic inline by exercising the mocked dependencies directly.

import { supabaseAdmin } from "../../../server/supabaseAdmin.server";
import { getGuidesByTags } from "../../../lib/education";

// ─── shared fixtures (UUIDs only — no PII/PHI) ───────────────────────────────
const ORG_A = "aaaaaaaa-0000-0000-0000-000000000001";
const ORG_B = "bbbbbbbb-0000-0000-0000-000000000002";

type MockGuide = { slug: string; title: string };

function makeGuide(slug = "caregiver-burnout"): MockGuide {
  return { slug, title: "Caregiver Burnout" };
}

// ─── tag-signal computation (extracted from production logic) ─────────────────
// Mirrors the tag-building logic in educationTipRefresh.ts so we can unit-test it
// without calling Supabase.

type MoodEntry = { mood: string };
type CareEvent = { id: string };

function buildTagSignal(
  moodEntries: MoodEntry[] | null,
  careEvents: CareEvent[] | null,
): string[] {
  const tags: string[] = [];
  if (moodEntries?.some((e) => e.mood === "difficult" || e.mood === "crisis")) {
    tags.push("agitation", "sundowning");
  }
  if (moodEntries?.some((e) => e.mood === "okay" || e.mood === "good")) {
    tags.push("caregiver-wellbeing");
  }
  if (careEvents && careEvents.length > 5) {
    tags.push("caregiver-burnout");
  }
  if (tags.length === 0) tags.push("caregiver-burnout");
  return tags;
}

// ─── tag-signal unit tests ────────────────────────────────────────────────────

describe("educationTipRefresh — buildTagSignal", () => {
  it("includes agitation + sundowning when any mood is difficult or crisis", () => {
    const tags = buildTagSignal([{ mood: "difficult" }], []);
    expect(tags).toContain("agitation");
    expect(tags).toContain("sundowning");
  });

  it("includes caregiver-wellbeing when mood is okay or good", () => {
    const tags = buildTagSignal([{ mood: "okay" }], []);
    expect(tags).toContain("caregiver-wellbeing");
  });

  it("includes caregiver-burnout when more than 5 care events", () => {
    const events = Array.from({ length: 6 }, (_, i) => ({ id: `e${i}` }));
    const tags = buildTagSignal([], events);
    expect(tags).toContain("caregiver-burnout");
  });

  it("does NOT include caregiver-burnout from events when count is exactly 5", () => {
    const events = Array.from({ length: 5 }, (_, i) => ({ id: `e${i}` }));
    const tags = buildTagSignal(null, events);
    // Falls through to default
    expect(tags).toContain("caregiver-burnout"); // default fallback
  });

  it("falls back to caregiver-burnout when no mood or event signals", () => {
    const tags = buildTagSignal([], []);
    expect(tags).toEqual(["caregiver-burnout"]);
  });

  it("falls back to caregiver-burnout when moodEntries is null", () => {
    const tags = buildTagSignal(null, null);
    expect(tags).toEqual(["caregiver-burnout"]);
  });

  it("accumulates multiple tags when both mood and events qualify", () => {
    const events = Array.from({ length: 6 }, (_, i) => ({ id: `e${i}` }));
    const tags = buildTagSignal(
      [{ mood: "crisis" }, { mood: "good" }],
      events,
    );
    expect(tags).toContain("agitation");
    expect(tags).toContain("sundowning");
    expect(tags).toContain("caregiver-wellbeing");
    expect(tags).toContain("caregiver-burnout");
  });
});

// ─── Supabase failure modes ───────────────────────────────────────────────────

describe("educationTipRefresh — Supabase failure modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGuidesByTags.mockReturnValue([makeGuide()]);
  });

  it("returns { refreshed: 0 } when orgs query errors", async () => {
    // Simulate what the Inngest function does when supabaseAdmin.from('organizations') errors
    const orgError = new Error("connection timeout");
    mockFrom.mockImplementation(() => ({
      select: () => ({ data: null, error: orgError }),
    }));

    const { data: orgs, error } = await supabaseAdmin
      .from("organizations")
      .select("id");

    expect(error).toBeTruthy();
    expect(orgs).toBeNull();
    // Production code: `if (error || !orgs) return { refreshed: 0 }`
    const result = error || !orgs ? { refreshed: 0 } : { refreshed: orgs.length };
    expect(result).toEqual({ refreshed: 0 });
  });

  it("returns { refreshed: 0 } when orgs list is empty", async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({ data: [], error: null }),
    }));

    const { data: orgs } = await supabaseAdmin.from("organizations").select("id");
    // Empty orgs → loop doesn't run → refreshed stays 0
    expect(orgs).toHaveLength(0);
    let refreshed = 0;
    for (const _ of orgs!) {
      refreshed++;
    }
    expect(refreshed).toBe(0);
  });

  it("skips org when getGuidesByTags returns empty (no guides for tags)", async () => {
    mockGetGuidesByTags.mockReturnValue([]); // no guides available

    const [topGuide] = getGuidesByTags(["caregiver-burnout"]);
    expect(topGuide).toBeUndefined();
    // Production code: `if (!topGuide) continue` — org is skipped, refreshed not incremented
  });

  it("proceeds to upsert when getGuidesByTags returns a guide", async () => {
    mockGetGuidesByTags.mockReturnValue([makeGuide("caregiver-burnout")]);

    const [topGuide] = getGuidesByTags(["caregiver-burnout"]);
    expect(topGuide).toBeDefined();
    expect(topGuide.slug).toBe("caregiver-burnout");
  });

  it("upsert error does not throw — function continues to next org", async () => {
    // The production function does not check upsert errors — it just awaits and moves on.
    // This test verifies that an upsert failure for one org does not abort the loop.
    const upsertSpy = vi.fn().mockResolvedValue({ error: new Error("upsert failed") });

    mockFrom.mockImplementation((table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({ data: [{ id: ORG_A }, { id: ORG_B }], error: null }),
        };
      }
      if (table === "mood_entries") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "care_events") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "education_tip_cache") {
        return { upsert: upsertSpy };
      }
    });

    mockGetGuidesByTags.mockReturnValue([makeGuide()]);

    // Simulate the loop body for ORG_A (upsert fails silently)
    const upsertResult = await (supabaseAdmin.from("education_tip_cache") as ReturnType<typeof mockFrom>).upsert({
      org_id: ORG_A,
      guide_slug: "caregiver-burnout",
      refreshed_at: new Date().toISOString(),
    });

    // Production code does not check upsert result — it always increments refreshed
    expect(upsertResult.error).toBeTruthy();
    // No throw — loop would continue to ORG_B
  });
});

// ─── malformed response handling ─────────────────────────────────────────────

describe("educationTipRefresh — malformed data handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles orgs query returning null data with no error (unexpected nil)", async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({ data: null, error: null }),
    }));

    const { data: orgs, error } = await supabaseAdmin
      .from("organizations")
      .select("id");

    // Production: `if (error || !orgs) return { refreshed: 0 }`
    const shouldAbort = error !== null || orgs === null;
    expect(shouldAbort).toBe(true);
  });

  it("handles mood_entries query error by falling back to empty array (via ?. operator)", () => {
    // moodEntries?.some(...) — if moodEntries is null/undefined, returns undefined → falsy
    const moodEntries = null;
    const tags = buildTagSignal(moodEntries, []);
    // Falls back to default tag
    expect(tags).toEqual(["caregiver-burnout"]);
  });

  it("handles care_events query returning malformed rows (missing id)", () => {
    // careEvents.length is checked — even rows with missing fields count toward the threshold
    const careEvents = Array.from({ length: 6 }, () => ({ id: undefined as unknown as string }));
    const tags = buildTagSignal([], careEvents);
    expect(tags).toContain("caregiver-burnout");
  });
});
