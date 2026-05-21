// @vitest-environment node
import { describe, it, expect } from "vitest";
import { digestHtml, weeklyDigestDedupKey } from "../weeklyDigest";

const ORG_NAME = "Smith Family";
const RECIPIENT_ID = "rec-001";
const APP_URL = "http://localhost:3000";

type Entry = {
  id: string;
  occurred_at: string;
  flagged: boolean;
  payload: { text?: string; mood?: string };
};

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "entry-1",
    occurred_at: "2026-04-07T10:00:00Z",
    flagged: false,
    payload: { text: "Had a good morning", mood: "good" },
    ...overrides,
  };
}

describe("digestHtml", () => {
  it("includes org name in the output", () => {
    const html = digestHtml({
      orgName: ORG_NAME,
      entries: [makeEntry()],
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 0,
    });
    expect(html).toContain(ORG_NAME);
  });

  it("includes a link to the recipient journal", () => {
    const html = digestHtml({
      orgName: ORG_NAME,
      entries: [makeEntry()],
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 0,
    });
    expect(html).toContain(`/journal/${RECIPIENT_ID}`);
  });

  it("shows flagged entry count when entries are flagged", () => {
    const entries = [
      makeEntry({ flagged: true }),
      makeEntry({ id: "entry-2", flagged: true }),
      makeEntry({ id: "entry-3", flagged: false }),
    ];
    const html = digestHtml({
      orgName: ORG_NAME,
      entries,
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 0,
    });
    expect(html).toContain("2");
    expect(html).toContain("flagged for doctor review");
  });

  it("does not include flagged section when no entries are flagged", () => {
    const html = digestHtml({
      orgName: ORG_NAME,
      entries: [makeEntry({ flagged: false })],
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 0,
    });
    expect(html).not.toContain("flagged for doctor review");
  });

  it("truncates long entry text to 140 chars with ellipsis", () => {
    const longText = "x".repeat(200);
    const html = digestHtml({
      orgName: ORG_NAME,
      entries: [makeEntry({ payload: { text: longText } })],
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 0,
    });
    // Should contain truncated text (140 chars) + ellipsis, not the full 200
    expect(html).toContain("x".repeat(140) + "\u2026");
    expect(html).not.toContain("x".repeat(141));
  });

  it("shows '+ N more entries' when more than 3 entries", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ id: `entry-${i}` }),
    );
    const html = digestHtml({
      orgName: ORG_NAME,
      entries,
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 0,
    });
    expect(html).toContain("+ 2 more entries");
  });

  it("includes shifts section when shifts are provided", () => {
    const shifts = [
      {
        start_at: "2026-04-14T09:00:00Z",
        end_at: "2026-04-14T17:00:00Z",
        assignee_name: "Alice",
        status: "scheduled",
      },
    ];
    const html = digestHtml({
      orgName: ORG_NAME,
      entries: [makeEntry()],
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts,
      medDoseCount: 0,
    });
    expect(html).toContain("Alice");
    expect(html).toContain("helping this week");
  });

  it("omits shifts section when no shifts are provided", () => {
    const html = digestHtml({
      orgName: ORG_NAME,
      entries: [makeEntry()],
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 0,
    });
    expect(html).not.toContain("helping this week");
  });

  it("includes mood summary when entries have mood", () => {
    const entries = [
      makeEntry({ payload: { mood: "good" } }),
      makeEntry({ id: "e2", payload: { mood: "good" } }),
      makeEntry({ id: "e3", payload: { mood: "anxious" } }),
    ];
    const html = digestHtml({
      orgName: ORG_NAME,
      entries,
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 0,
    });
    expect(html).toContain("good");
    expect(html).toContain("anxious");
  });

  it("omits medication section when medDoseCount is 0", () => {
    const html = digestHtml({
      orgName: ORG_NAME,
      entries: [makeEntry()],
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 0,
    });
    expect(html).not.toContain("medication dose");
  });

  it("shows singular 'medication dose' when medDoseCount is 1", () => {
    const html = digestHtml({
      orgName: ORG_NAME,
      entries: [makeEntry()],
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 1,
    });
    expect(html).toContain("1 medication dose recorded this week");
    expect(html).not.toContain("medication doses");
  });

  it("shows plural 'medication doses' when medDoseCount is 5", () => {
    const html = digestHtml({
      orgName: ORG_NAME,
      entries: [makeEntry()],
      recipientId: RECIPIENT_ID,
      appUrl: APP_URL,
      shifts: [],
      medDoseCount: 5,
    });
    expect(html).toContain("5 medication doses recorded this week");
  });
});

// ─── TD-187 — idempotency dedup key ──────────────────────────────────────────
// The weekly digest is org-level (one email per org to all members), so the
// dedup_key is keyed on (org, ISO week) — NOT recipient. The unique constraint
// email_dispatch_log_kind_dedup_unique (kind, dedup_key) makes an Inngest retry
// or a concurrent worker hit 23505 and skip instead of re-sending.

describe("weeklyDigestDedupKey", () => {
  it("composes the canonical weekly_digest dedup_key shape", () => {
    expect(weeklyDigestDedupKey("org-a", "2026-W21")).toBe(
      "weekly_digest:org-a:2026-W21",
    );
  });

  it("per-week stamps yield distinct keys (dedup-window correctness)", () => {
    const k1 = weeklyDigestDedupKey("org-a", "2026-W21");
    const k2 = weeklyDigestDedupKey("org-a", "2026-W22");
    expect(k1).not.toBe(k2);
  });

  it("per-org keys are distinct within the same week", () => {
    const a = weeklyDigestDedupKey("org-a", "2026-W21");
    const b = weeklyDigestDedupKey("org-b", "2026-W21");
    expect(a).not.toBe(b);
  });
});

// ─── TD-187 — PHI sentinel: Sentry calls must never carry recipient PHI ───────
// On a DB insert error or a Resend send error the digest captures to Sentry.
// The ESLint rule (carelog/no-phi-in-analytics) is a static keys-only check on
// object literals; it cannot catch forbidden field-name STRINGS inside Sentry
// call bodies or spreads. This source-file sentinel closes that gap. Mirrors the
// refillAlert M2 sentinel — keep both; they are complementary, not redundant.

describe("PHI sentinel (TD-187) — weeklyDigest source file invariants", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const source = fs.readFileSync(
    path.resolve(__dirname, "../weeklyDigest.ts"),
    "utf-8",
  );

  it("Sentry calls in weeklyDigest.ts never reference recipient PHI fields", () => {
    const sentryBlocks = source.match(/Sentry\.[\s\S]*?\}\s*\)/g) ?? [];
    expect(sentryBlocks.length).toBeGreaterThan(0);
    for (const block of sentryBlocks) {
      const lower = block.toLowerCase();
      expect(lower).not.toContain("email");
      expect(lower).not.toContain("recipient");
      expect(lower).not.toContain("org.name");
      expect(lower).not.toContain("entries");
      // No spreads smuggling caller-controlled PHI into Sentry options.
      expect(block).not.toMatch(/\.\.\.input\b/);
      expect(block).not.toMatch(/\.\.\.event\b/);
    }
  });

  it("dedup row INSERT carries only org-level identifiers (no recipient/email)", () => {
    // Match only the .insert({...}) object payload — the table name
    // "email_dispatch_log" itself contains "email", so it must not be in scope.
    const insertMatch = source.match(/\.insert\(\{([\s\S]*?)\}\)/);
    expect(insertMatch).not.toBeNull();
    const payload = insertMatch![1].toLowerCase();
    expect(payload).toContain("org_id");
    expect(payload).toContain("dedup_key");
    expect(payload).not.toContain("email");
    expect(payload).not.toContain("recipient_id");
  });

  // TD-209: the pending-row sweep must exist and be correctly scoped — these
  // are the load-bearing invariants (a missing kind filter would delete other
  // crons' rows; a missing sent_at-null guard would delete delivered digests).
  it("has a kind-scoped weekly_digest pending-row sweep", () => {
    // Isolate the FULL sweep step.run body (label → its 6-space-indented closing
    // `});`), not a fixed-width window. A fixed slice silently drops assertions
    // if the body grows (e.g. adding a try/catch), letting a real regression pass.
    const sweepMatch = source.match(
      /step\.run\("sweep-pending-weekly-dispatch",[\s\S]*?\n {6}\}\);/,
    );
    expect(sweepMatch).not.toBeNull();
    const sweep = sweepMatch![0];
    // delete, scoped to weekly_digest, only stale-pending rows.
    expect(sweep).toContain(".delete()");
    expect(sweep).toContain('.eq("kind", "weekly_digest")');
    expect(sweep).toContain('.is("sent_at", null)');
    expect(sweep).toMatch(/\.lt\("created_at"/);
    // Must NOT broaden to other kinds.
    expect(sweep).not.toContain('"refill"');
    expect(sweep).not.toContain('"task"');
  });

  it("sweep step appears before the per-org send fan-out (single run-level step)", () => {
    // Match the quoted step.run() labels, not bare substrings — the sweep's own
    // comment mentions "find-active-orgs", which would otherwise collide.
    const sweepIdx = source.indexOf('"sweep-pending-weekly-dispatch"');
    const fanoutIdx = source.indexOf('"send-digest-"');
    const findOrgsIdx = source.indexOf('"find-active-orgs"');
    expect(sweepIdx).toBeGreaterThan(-1);
    expect(findOrgsIdx).toBeGreaterThan(-1);
    expect(fanoutIdx).toBeGreaterThan(-1);
    // Before both find-active-orgs (so a zero-activity week still sweeps) and
    // the send fan-out (so it's one run-level step, not N per-org).
    expect(sweepIdx).toBeLessThan(findOrgsIdx);
    expect(sweepIdx).toBeLessThan(fanoutIdx);
    // Exactly one occurrence of the step label.
    expect(source.split('"sweep-pending-weekly-dispatch"').length - 1).toBe(1);
  });
});
