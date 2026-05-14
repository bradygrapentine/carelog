import { describe, it, expect } from "vitest";
import { buildHandoffSummary } from "../handoffSummary";
import type { CareEvent } from "@carelog/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-04-23T12:00:00Z");

function makeEvent(
  overrides: Partial<CareEvent> & Pick<CareEvent, "event_type">,
  hoursAgo = 1,
): CareEvent {
  const occurred_at = new Date(
    NOW.getTime() - hoursAgo * 60 * 60 * 1000,
  ).toISOString();
  return {
    id: crypto.randomUUID(),
    org_id: "org-1",
    recipient_id: "rec-1",
    actor_id: "actor-a",
    entry_kind: "human",
    payload: {},
    flagged: false,
    occurred_at,
    created_at: occurred_at,
    ...overrides,
  };
}

// ─── Empty input ──────────────────────────────────────────────────────────────

describe("buildHandoffSummary — empty input", () => {
  it("returns 'no' copy for all sections", () => {
    const result = buildHandoffSummary([], NOW, 24);
    expect(result.meds.description).toBe(
      "No medications logged in this window.",
    );
    expect(result.moments.description).toBe(
      "No journal entries in this window.",
    );
    expect(result.appointments.description).toBe("No visits in this window.");
    expect(result.concerns.description).toBe(
      "No concerns flagged in this window.",
    );
    expect(result.thanks.description).toBe("No activity in this window.");
  });

  it("returns zero counts", () => {
    const result = buildHandoffSummary([], NOW, 24);
    expect(result.meds.count).toBe(0);
    expect(result.moments.items).toHaveLength(0);
    expect(result.appointments.completed).toBe(0);
    expect(result.appointments.upcomingIn24h).toBe(0);
    expect(result.concerns.hasConcerns).toBe(false);
    expect(result.thanks.contributors).toHaveLength(0);
  });
});

// ─── Medication counting ──────────────────────────────────────────────────────

describe("buildHandoffSummary — medications", () => {
  it("counts 12 doses split between 2 actors with correct description", () => {
    const events: CareEvent[] = [
      ...Array.from({ length: 10 }, () =>
        makeEvent({ event_type: "medication", actor_id: "actor-maya" }),
      ),
      ...Array.from({ length: 2 }, () =>
        makeEvent({ event_type: "medication", actor_id: "actor-jordan" }),
      ),
    ];
    const nameMap = { "actor-maya": "Maya", "actor-jordan": "Jordan" };
    const result = buildHandoffSummary(events, NOW, 24, undefined, nameMap);

    expect(result.meds.count).toBe(12);
    expect(result.meds.description).toContain("12 doses logged");
    expect(result.meds.description).toContain("10 by Maya");
    expect(result.meds.description).toContain("2 by Jordan");
  });

  it("uses singular 'dose' for exactly 1", () => {
    const result = buildHandoffSummary(
      [makeEvent({ event_type: "medication" })],
      NOW,
      24,
    );
    expect(result.meds.description).toContain("1 dose logged");
  });
});

// ─── Mixed event types section routing ───────────────────────────────────────

describe("buildHandoffSummary — mixed event types", () => {
  const events: CareEvent[] = [
    makeEvent({ event_type: "medication" }),
    makeEvent({
      event_type: "journal",
      entry_kind: "human",
      payload: { text: "Mom seemed comfortable today.", mood: "good" },
    }),
    makeEvent({ event_type: "appointment" }),
    makeEvent({ event_type: "symptom" }),
    makeEvent({ event_type: "expense" }), // should not appear in any named section
  ];

  it("routes medication only to meds section", () => {
    const result = buildHandoffSummary(events, NOW, 24);
    expect(result.meds.count).toBe(1);
  });

  it("routes journal entry to moments section", () => {
    const result = buildHandoffSummary(events, NOW, 24);
    expect(result.moments.items).toHaveLength(1);
    expect(result.moments.items[0]?.mood).toBe("good");
  });

  it("routes appointment to appointments section", () => {
    const result = buildHandoffSummary(events, NOW, 24);
    expect(result.appointments.completed).toBe(1);
  });

  it("routes symptom to concerns section", () => {
    const result = buildHandoffSummary(events, NOW, 24);
    expect(result.concerns.hasConcerns).toBe(true);
    expect(result.concerns.items).toHaveLength(1);
  });
});

// ─── Crisis / flagged events → Concerns ──────────────────────────────────────

describe("buildHandoffSummary — concerns", () => {
  it("includes flagged journal entry in concerns", () => {
    const event = makeEvent({
      event_type: "journal",
      flagged: true,
      payload: { text: "She had a fall." },
    });
    const result = buildHandoffSummary([event], NOW, 24);
    expect(result.concerns.hasConcerns).toBe(true);
    expect(result.concerns.items[0]?.flagged).toBe(true);
  });

  it("includes symptom event in concerns", () => {
    const event = makeEvent({ event_type: "symptom" });
    const result = buildHandoffSummary([event], NOW, 24);
    expect(result.concerns.hasConcerns).toBe(true);
  });

  it("sets hasConcerns=false when no symptom or flagged events", () => {
    const events = [
      makeEvent({ event_type: "journal" }),
      makeEvent({ event_type: "medication" }),
    ];
    const result = buildHandoffSummary(events, NOW, 24);
    expect(result.concerns.hasConcerns).toBe(false);
  });
});

// ─── Window filter ────────────────────────────────────────────────────────────

describe("buildHandoffSummary — window filter", () => {
  it("excludes events older than windowHours", () => {
    const old = makeEvent({ event_type: "medication" }, 25); // 25h ago, outside 24h window
    const fresh = makeEvent({ event_type: "medication" }, 1); // 1h ago, inside
    const result = buildHandoffSummary([old, fresh], NOW, 24);
    expect(result.meds.count).toBe(1);
  });

  it("includes events exactly at window boundary", () => {
    const boundary = makeEvent({ event_type: "medication" }, 24); // exactly 24h ago
    const result = buildHandoffSummary([boundary], NOW, 24);
    expect(result.meds.count).toBe(1);
  });

  it("respects 48h window", () => {
    const old = makeEvent({ event_type: "medication" }, 49);
    const mid = makeEvent({ event_type: "medication" }, 36);
    const fresh = makeEvent({ event_type: "medication" }, 1);
    const result48 = buildHandoffSummary([old, mid, fresh], NOW, 48);
    expect(result48.meds.count).toBe(2);
  });
});

// ─── Moments top-3 limit ──────────────────────────────────────────────────────

describe("buildHandoffSummary — moments top-3", () => {
  it("returns at most 3 journal entries even when more exist", () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent(
        {
          event_type: "journal",
          entry_kind: "human",
          payload: { text: `Entry ${i}` },
        },
        i + 1,
      ),
    );
    const result = buildHandoffSummary(events, NOW, 24);
    expect(result.moments.items).toHaveLength(3);
  });

  it("returns the 3 most recent entries", () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent(
        {
          event_type: "journal",
          entry_kind: "human",
          payload: { text: `Entry at ${i + 1}h ago` },
        },
        i + 1,
      ),
    );
    const result = buildHandoffSummary(events, NOW, 24);
    // Most recent is 1h ago
    expect(result.moments.items[0]?.excerpt).toContain("Entry at 1h ago");
  });
});

// ─── Thanks section ───────────────────────────────────────────────────────────

describe("buildHandoffSummary — thanks", () => {
  it("shows 'Just you' when only viewer contributed", () => {
    const events = [
      makeEvent({ event_type: "journal", actor_id: "viewer-id" }),
      makeEvent({ event_type: "medication", actor_id: "viewer-id" }),
    ];
    const result = buildHandoffSummary(events, NOW, 24, "viewer-id");
    expect(result.thanks.viewerOnly).toBe(true);
    expect(result.thanks.description).toBe("Just you in this window.");
  });

  it("lists multiple contributors with counts", () => {
    const events = [
      makeEvent({ event_type: "journal", actor_id: "actor-a" }),
      makeEvent({ event_type: "journal", actor_id: "actor-a" }),
      makeEvent({ event_type: "medication", actor_id: "actor-b" }),
    ];
    const nameMap = { "actor-a": "Maya", "actor-b": "Jordan" };
    const result = buildHandoffSummary(events, NOW, 24, "viewer-id", nameMap);
    expect(result.thanks.viewerOnly).toBe(false);
    expect(result.thanks.description).toContain("Maya");
    expect(result.thanks.description).toContain("Jordan");
    expect(result.thanks.contributors[0]?.count).toBe(2); // sorted by count desc
  });
});

// ─── Characterization snapshot (pre-refactor baseline) ───────────────────────
// This snapshot locks in the exact output of buildHandoffSummary() before the
// NameResolver refactor. If the refactor changes behaviour the snapshot will
// fail — that is intentional and must be investigated before proceeding.

describe("buildHandoffSummary — characterization snapshot", () => {
  const SNAP_NOW = new Date("2026-01-15T10:00:00Z");

  function snapEvent(
    overrides: Partial<CareEvent> & Pick<CareEvent, "event_type">,
    hoursAgo = 1,
  ): CareEvent {
    const occurred_at = new Date(
      SNAP_NOW.getTime() - hoursAgo * 60 * 60 * 1000,
    ).toISOString();
    return {
      id: "snap-id-fixed",
      org_id: "org-snap",
      recipient_id: "rec-snap",
      actor_id: "actor-snap-a",
      entry_kind: "human",
      payload: {},
      flagged: false,
      occurred_at,
      created_at: occurred_at,
      ...overrides,
    };
  }

  const snapEvents: CareEvent[] = [
    snapEvent({ event_type: "medication", actor_id: "actor-maya" }, 2),
    snapEvent({ event_type: "medication", actor_id: "actor-maya" }, 3),
    snapEvent({ event_type: "medication", actor_id: "actor-jordan" }, 4),
    snapEvent(
      {
        event_type: "journal",
        actor_id: "actor-maya",
        entry_kind: "human",
        payload: { text: "She had a good morning.", mood: "good" },
      },
      1,
    ),
    snapEvent({ event_type: "appointment", actor_id: "actor-jordan" }, 5),
    snapEvent({ event_type: "symptom", actor_id: "actor-maya" }, 6),
    // actor with no name in map — falls back to "Team member"
    snapEvent({ event_type: "medication", actor_id: "actor-unknown" }, 7),
  ];

  const snapNameMap = { "actor-maya": "Maya", "actor-jordan": "Jordan" };

  it("characterization: exact output matches pre-refactor baseline", () => {
    const result = buildHandoffSummary(
      snapEvents,
      SNAP_NOW,
      24,
      "viewer-snap",
      snapNameMap,
    );

    // Meds — 2 Maya + 1 Jordan + 1 unknown(Team member)
    expect(result.meds.count).toBe(4);
    expect(result.meds.description).toContain("4 doses logged");
    expect(result.meds.description).toContain("2 by Maya");
    expect(result.meds.description).toContain("1 by Jordan");
    expect(result.meds.description).toContain("1 by Team member");

    // Moments
    expect(result.moments.items).toHaveLength(1);
    expect(result.moments.items[0]?.excerpt).toBe("She had a good morning.");
    expect(result.moments.items[0]?.mood).toBe("good");

    // Appointments
    expect(result.appointments.completed).toBe(1);
    expect(result.appointments.description).toContain("1 completed visit");

    // Concerns
    expect(result.concerns.hasConcerns).toBe(true);
    expect(result.concerns.items).toHaveLength(1);
    expect(result.concerns.items[0]?.excerpt).toBe("symptom");

    // Thanks — viewer "viewer-snap" is not a contributor so viewerOnly=false
    expect(result.thanks.viewerOnly).toBe(false);
    expect(result.thanks.description).toContain("Maya");
    expect(result.thanks.description).toContain("Jordan");
    expect(result.thanks.description).toContain("Team member");
  });
});
