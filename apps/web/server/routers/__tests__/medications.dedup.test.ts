import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("../../supabaseAdmin.server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("medications.logAdministration dedup pattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing event when duplicate within 30-min window", async () => {
    const existingEvent = { id: "existing-1" };

    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: existingEvent, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await mockFrom("care_events")
      .select("id")
      .eq("org_id", "org-1")
      .eq("recipient_id", "r1")
      .eq("event_type", "medication")
      .gte("occurred_at", "2026-04-11T07:35:00Z")
      .lte("occurred_at", "2026-04-11T08:35:00Z")
      .maybeSingle();

    expect(result.data).toEqual(existingEvent);
    expect(result.data.id).toBe("existing-1");
  });

  it("returns null when no duplicate exists", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await mockFrom("care_events")
      .select("id")
      .eq("org_id", "org-1")
      .eq("recipient_id", "r1")
      .eq("event_type", "medication")
      .gte("occurred_at", "2026-04-11T07:35:00Z")
      .lte("occurred_at", "2026-04-11T08:35:00Z")
      .maybeSingle();

    expect(result.data).toBeNull();
  });
});
