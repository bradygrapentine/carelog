// @vitest-environment node
import { describe, it, expect } from "vitest";
import { digestHtml } from "../weeklyDigest";

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
    });
    expect(html).toContain("good");
    expect(html).toContain("anxious");
  });
});
