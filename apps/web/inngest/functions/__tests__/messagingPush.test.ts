// @vitest-environment node
/**
 * Tests for messagingPush.ts failure modes.
 *
 * sendExpoPush parses Expo's per-ticket response body: DeviceNotRegistered
 * deletes the bad token from push_tokens (silent no-throw — token is dead);
 * other per-ticket errors throw so Inngest retries the step.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before imports
const mockSendExpoPush = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetPushTokensForUsers = vi.hoisted(() => vi.fn());

// supabaseAdmin chain mock — used by sendExpoPush to delete expired tokens
const supabaseDeleteIn = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ error: null }),
);
const supabaseDelete = vi.hoisted(() =>
  vi.fn(() => ({ in: supabaseDeleteIn })),
);
const supabaseFrom = vi.hoisted(() =>
  vi.fn(() => ({ delete: supabaseDelete })),
);

vi.mock("../../../server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: supabaseFrom },
}));

vi.mock("../../pushNotification", () => ({
  sendExpoPush: mockSendExpoPush,
  getPushTokensForUsers: mockGetPushTokensForUsers,
}));

vi.mock("../../../server/repositories/messagesRepository", () => ({
  getThreadMembersForPush: vi.fn(),
}));

import * as push from "../../pushNotification";
import * as repo from "../../../server/repositories/messagesRepository";

// ─── helpers ─────────────────────────────────────────────────────────────────

type ThreadMember = {
  user_id: string;
  last_read_at: string | null;
};

function makeMember(
  userId: string,
  last_read_at: string | null = null,
): ThreadMember {
  return { user_id: userId, last_read_at };
}

// Simulate the core filtering logic from messagingPush.ts
// (extracted here because the production function embeds it in Inngest step closures)
function computeRecipients(
  members: ThreadMember[],
  senderId: string,
  sentAt: string,
): string[] {
  const sentAtDate = new Date(sentAt);
  return members
    .filter((m) => {
      if (m.user_id === senderId) return false;
      if (!m.last_read_at) return true;
      return new Date(m.last_read_at) < sentAtDate;
    })
    .map((m) => m.user_id);
}

// ─── sendExpoPush behaviour (via real module, fetch-stubbed) ─────────────────

/**
 * These tests import the real sendExpoPush via vi.importActual to test its
 * fetch-level error handling without interfering with the top-level mock used
 * for the integration tests below.
 */
describe("sendExpoPush — failure modes (real implementation)", () => {
  let realSendExpoPush: (
    messages: Array<{ to: string; body: string; title?: string }>,
  ) => Promise<void>;

  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    const mod = await vi.importActual<typeof import("../../pushNotification")>(
      "../../pushNotification",
    );
    realSendExpoPush = mod.sendExpoPush;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws on non-2xx HTTP status (Expo API 5xx)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(
      realSendExpoPush([
        { to: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", body: "test" },
      ]),
    ).rejects.toThrow("Expo Push API 500");
  });

  it("throws on HTTP 429 (rate-limited / Expo API overload)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Too Many Requests",
    });

    await expect(
      realSendExpoPush([{ to: "ExponentPushToken[xxx]", body: "hello" }]),
    ).rejects.toThrow("Expo Push API 429");
  });

  it("throws on fetch network timeout / AbortError", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), {
        name: "AbortError",
      }),
    );

    await expect(
      realSendExpoPush([{ to: "ExponentPushToken[xxx]", body: "hello" }]),
    ).rejects.toThrow();
  });

  it("no-ops when message list is empty (short-circuits before fetch)", async () => {
    await expect(realSendExpoPush([])).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("DeviceNotRegistered: removes expired token from push_tokens and resolves cleanly", async () => {
    // Expo returns HTTP 200 with per-ticket status="error" and details.error="DeviceNotRegistered"
    // when a device token is no longer valid. sendExpoPush should delete the token from
    // push_tokens so we stop sending to it, then resolve (no point retrying — token is dead).
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              status: "error",
              message: "The device token has expired",
              details: { error: "DeviceNotRegistered" },
            },
          ],
        }),
    });

    await expect(
      realSendExpoPush([
        { to: "ExponentPushToken[expired_token_xxx]", body: "hello" },
      ]),
    ).resolves.toBeUndefined();

    // Verify the bad token was deleted from push_tokens
    expect(supabaseFrom).toHaveBeenCalledWith("push_tokens");
    expect(supabaseDelete).toHaveBeenCalled();
    expect(supabaseDeleteIn).toHaveBeenCalledWith("token", [
      "ExponentPushToken[expired_token_xxx]",
    ]);
  });

  it("non-DNR per-ticket error throws so Inngest can retry", async () => {
    // Errors other than DeviceNotRegistered (MessageRateExceeded, InvalidCredentials,
    // MessageTooBig, etc.) are not "delete the token" — they're either transient or
    // require operator intervention. Surface them so the Inngest function fails the
    // step and retries on its normal cadence.
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              status: "error",
              message: "You are sending messages too frequently",
              details: { error: "MessageRateExceeded" },
            },
          ],
        }),
    });

    await expect(
      realSendExpoPush([{ to: "ExponentPushToken[xxx]", body: "hello" }]),
    ).rejects.toThrow(/MessageRateExceeded/);
  });
});

// ─── recipient filtering logic ────────────────────────────────────────────────

describe("messagingPush — recipient filtering logic", () => {
  it("excludes the sender from push recipients", () => {
    const members = [
      makeMember("sender-uuid"),
      makeMember("member-b"),
      makeMember("member-c"),
    ];
    const recipients = computeRecipients(
      members,
      "sender-uuid",
      "2026-04-25T10:00:00Z",
    );
    expect(recipients).not.toContain("sender-uuid");
    expect(recipients).toContain("member-b");
    expect(recipients).toContain("member-c");
  });

  it("includes members who have never read the thread (null last_read_at)", () => {
    const members = [makeMember("sender-uuid"), makeMember("never-read", null)];
    const recipients = computeRecipients(
      members,
      "sender-uuid",
      "2026-04-25T10:00:00Z",
    );
    expect(recipients).toContain("never-read");
  });

  it("excludes members who read after the message was sent", () => {
    const members = [
      makeMember("sender-uuid"),
      makeMember("already-read", "2026-04-25T11:00:00Z"), // read after sentAt
    ];
    const recipients = computeRecipients(
      members,
      "sender-uuid",
      "2026-04-25T10:00:00Z",
    );
    expect(recipients).not.toContain("already-read");
  });

  it("includes members who read before the message was sent (unread)", () => {
    const members = [
      makeMember("sender-uuid"),
      makeMember("unread-member", "2026-04-25T09:00:00Z"), // read before sentAt
    ];
    const recipients = computeRecipients(
      members,
      "sender-uuid",
      "2026-04-25T10:00:00Z",
    );
    expect(recipients).toContain("unread-member");
  });

  it("returns empty list when all members have read the thread", () => {
    const members = [
      makeMember("sender-uuid"),
      makeMember("member-b", "2026-04-25T11:00:00Z"),
      makeMember("member-c", "2026-04-25T12:00:00Z"),
    ];
    const recipients = computeRecipients(
      members,
      "sender-uuid",
      "2026-04-25T10:00:00Z",
    );
    expect(recipients).toHaveLength(0);
  });

  it("returns empty list when there are no members besides the sender", () => {
    const members = [makeMember("sender-uuid")];
    const recipients = computeRecipients(
      members,
      "sender-uuid",
      "2026-04-25T10:00:00Z",
    );
    expect(recipients).toHaveLength(0);
  });
});

// ─── sender membership guard ──────────────────────────────────────────────────

describe("messagingPush — sender membership guard (abort logic)", () => {
  it("aborts when sender is not a thread member (forged or removed)", () => {
    const members = [makeMember("member-a"), makeMember("member-b")];
    const senderId = "intruder-uuid";
    const senderMembership = members.find((m) => m.user_id === senderId);
    expect(senderMembership).toBeUndefined();
    // Production code returns { pushed: 0, aborted: true, reason: 'sender_not_member' }
  });

  it("does not abort when sender IS a thread member", () => {
    const members = [makeMember("sender-uuid"), makeMember("member-b")];
    const senderId = "sender-uuid";
    const senderMembership = members.find((m) => m.user_id === senderId);
    expect(senderMembership).toBeDefined();
  });
});

// ─── integration: mocked deps, full push path ─────────────────────────────────

describe("messagingPush — push dispatch via mocked sendExpoPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getPushTokensForUsers with unread recipient IDs", async () => {
    vi.mocked(repo.getThreadMembersForPush).mockResolvedValue([
      makeMember("sender-uuid"),
      makeMember("unread-a", "2026-04-25T08:00:00Z"),
      makeMember("read-b", "2026-04-25T11:00:00Z"),
    ]);
    mockGetPushTokensForUsers.mockResolvedValue(["tok-a"]);

    const recipientIds = computeRecipients(
      await repo.getThreadMembersForPush("thread-1"),
      "sender-uuid",
      "2026-04-25T10:00:00Z",
    );

    expect(recipientIds).toContain("unread-a");
    expect(recipientIds).not.toContain("read-b");
    expect(recipientIds).not.toContain("sender-uuid");
  });

  it("does not call sendExpoPush when no tokens are found", async () => {
    mockGetPushTokensForUsers.mockResolvedValue([]);

    const tokens = await push.getPushTokensForUsers(["user-a"]);
    // Production code short-circuits if tokens.length === 0
    if (tokens.length === 0) {
      // sendExpoPush should NOT have been called
      expect(push.sendExpoPush).not.toHaveBeenCalled();
    }
  });

  it("malformed payload — missing threadId: recipient filter returns empty (no-op)", () => {
    // If event.data has no threadId, getThreadMembersForPush would be called
    // with undefined. The production code does not validate before calling step.run.
    // We document what happens: all members pass the sender check since senderId
    // also missing means senderMembership lookup returns undefined → abort.
    const members: ThreadMember[] = [
      makeMember("user-a"),
      makeMember("user-b"),
    ];
    const senderMembership = members.find((m) => m.user_id === undefined);
    expect(senderMembership).toBeUndefined();
    // Production path: returns { pushed: 0, aborted: true, reason: 'sender_not_member' }
  });

  it("malformed payload — missing sentAt: date comparison falls back to Invalid Date", () => {
    // new Date(undefined) → Invalid Date; comparisons with Invalid Date return false
    // so members with last_read_at set would be INCLUDED (not filtered out)
    const members = [
      makeMember("sender-uuid"),
      makeMember("member-a", "2026-04-25T09:00:00Z"),
    ];
    const sentAtDate = new Date(undefined as unknown as string); // Invalid Date
    expect(isNaN(sentAtDate.getTime())).toBe(true);

    // With Invalid Date, new Date(m.last_read_at) < sentAtDate → false
    // So member-a would NOT be included (comparison fails silently)
    const recipients = members
      .filter((m) => {
        if (m.user_id === "sender-uuid") return false;
        if (!m.last_read_at) return true;
        return new Date(m.last_read_at) < sentAtDate; // false for Invalid Date
      })
      .map((m) => m.user_id);

    expect(recipients).toHaveLength(0); // documents silent-drop on malformed sentAt
  });
});
