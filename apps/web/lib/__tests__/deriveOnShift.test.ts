import { describe, it, expect } from "vitest";
import { deriveOnShift } from "../deriveOnShift";

// now = 2026-05-01T10:00:00Z
const NOW = new Date("2026-05-01T10:00:00.000Z");

function shift(overrides: {
  id?: string;
  user_id?: string;
  starts_at?: string;
  ends_at?: string;
}) {
  return {
    id: overrides.id ?? "shift-1",
    user_id: overrides.user_id ?? "user-1",
    starts_at: overrides.starts_at ?? "2026-05-01T08:00:00.000Z",
    ends_at: overrides.ends_at ?? "2026-05-01T16:00:00.000Z",
  };
}

function member(overrides: {
  user_id?: string;
  display_name?: string | null;
  email?: string | null;
}) {
  return {
    user_id: overrides.user_id ?? "user-1",
    display_name: "display_name" in overrides ? overrides.display_name ?? null : "Alice Johnson",
    email: "email" in overrides ? overrides.email ?? null : "alice@example.com",
  };
}

describe("deriveOnShift", () => {
  it("onNow picks the shift containing now", () => {
    const result = deriveOnShift({
      shifts: [
        shift({ starts_at: "2026-05-01T08:00:00.000Z", ends_at: "2026-05-01T16:00:00.000Z" }),
      ],
      members: [member({})],
      latestMood: null,
      now: NOW,
    });
    expect(result.onNow).not.toBeNull();
    expect(result.onNow?.id).toBe("user-1");
  });

  it("upNext picks the next future shift", () => {
    const result = deriveOnShift({
      shifts: [
        shift({ id: "s1", user_id: "user-1", starts_at: "2026-05-01T08:00:00.000Z", ends_at: "2026-05-01T16:00:00.000Z" }),
        shift({ id: "s2", user_id: "user-2", starts_at: "2026-05-01T16:00:00.000Z", ends_at: "2026-05-02T00:00:00.000Z" }),
      ],
      members: [
        member({ user_id: "user-1" }),
        member({ user_id: "user-2", display_name: "Bob Smith" }),
      ],
      latestMood: null,
      now: NOW,
    });
    expect(result.upNext).not.toBeNull();
    expect(result.upNext?.id).toBe("user-2");
    expect(result.upNext?.name).toBe("Bob Smith");
  });

  it("resolves caregiver name from members lookup; falls back to email", () => {
    const result = deriveOnShift({
      shifts: [
        shift({ user_id: "user-no-name" }),
      ],
      members: [
        member({ user_id: "user-no-name", display_name: null, email: "fallback@example.com" }),
      ],
      latestMood: null,
      now: NOW,
    });
    expect(result.onNow?.name).toBe("fallback@example.com");
  });

  it("initials are first letters of display_name (uppercase, max 2)", () => {
    const result = deriveOnShift({
      shifts: [shift({ user_id: "user-1" })],
      members: [member({ user_id: "user-1", display_name: "Carol Anne Davis" })],
      latestMood: null,
      now: NOW,
    });
    expect(result.onNow?.initials).toBe("CA");
  });

  it("shiftLabel formats start-end times", () => {
    const result = deriveOnShift({
      shifts: [
        shift({ starts_at: "2026-05-01T08:00:00.000Z", ends_at: "2026-05-01T16:00:00.000Z" }),
      ],
      members: [member({})],
      latestMood: null,
      now: NOW,
    });
    // shiftLabel should be something like "8 AM–4 PM" or "8:00 AM–4:00 PM"
    expect(result.onNow?.shiftLabel).toBeDefined();
    expect(typeof result.onNow?.shiftLabel).toBe("string");
    expect(result.onNow?.shiftLabel?.length).toBeGreaterThan(0);
  });

  it("latestMood passes through; null input yields null output", () => {
    const resultNull = deriveOnShift({
      shifts: [],
      members: [],
      latestMood: null,
      now: NOW,
    });
    expect(resultNull.latestMood).toBeNull();

    const resultMood = deriveOnShift({
      shifts: [],
      members: [],
      latestMood: {
        label: "good",
        occurredAt: "2026-04-30T14:30:00.000Z",
        by: "Alice Johnson",
        note: "Doing great today",
      },
      now: NOW,
    });
    expect(resultMood.latestMood).not.toBeNull();
    expect(resultMood.latestMood?.label).toBe("good");
    expect(resultMood.latestMood?.by).toBe("Alice Johnson");
    expect(resultMood.latestMood?.note).toBe("Doing great today");
    expect(typeof resultMood.latestMood?.when).toBe("string");
    expect(resultMood.latestMood?.when.length).toBeGreaterThan(0);
  });
});
