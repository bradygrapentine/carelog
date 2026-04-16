import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendPushToUser, sendWebPushToUser } from "../pushNotification";

const { mockFrom, mockSendNotification } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSendNotification: vi.fn(),
}));
vi.mock("../../server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: mockFrom },
}));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: mockSendNotification,
  },
}));

global.fetch = vi.fn() as unknown as typeof fetch;

describe("sendPushToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends push to user token", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ token: "ExponentPushToken[abc123]" }],
        error: null,
      }),
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => "",
    });

    await sendPushToUser("user-uuid", { body: "Scan ready" });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("no-ops when user has no push token", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    await sendPushToUser("user-uuid", { body: "Scan ready" });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("sendWebPushToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when no subscriptions found", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    await sendWebPushToUser("user-uuid", {
      title: "Test",
      body: "Hello",
    });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("calls webPush.sendNotification for each subscription", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            endpoint: "https://push.example.com/sub1",
            p256dh_key: "key1",
            auth_key: "auth1",
          },
          {
            endpoint: "https://push.example.com/sub2",
            p256dh_key: "key2",
            auth_key: "auth2",
          },
        ],
        error: null,
      }),
    });
    mockSendNotification.mockResolvedValue({});

    await sendWebPushToUser("user-uuid", { title: "New note", body: "A care note was added" });

    expect(mockSendNotification).toHaveBeenCalledTimes(2);
    expect(mockSendNotification).toHaveBeenCalledWith(
      {
        endpoint: "https://push.example.com/sub1",
        keys: { p256dh: "key1", auth: "auth1" },
      },
      JSON.stringify({ title: "New note", body: "A care note was added" }),
    );
  });

  it("removes expired subscription on sendNotification failure", async () => {
    const mockDelete = vi.fn().mockReturnThis();
    const mockEqDelete = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "web_push_subscriptions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                endpoint: "https://push.example.com/expired",
                p256dh_key: "key",
                auth_key: "auth",
              },
            ],
            error: null,
          }),
          delete: mockDelete,
        };
      }
      return { select: vi.fn(), eq: vi.fn(), delete: vi.fn() };
    });
    mockDelete.mockReturnValue({ eq: mockEqDelete });
    mockSendNotification.mockRejectedValue(new Error("410 Gone"));

    await sendWebPushToUser("user-uuid", { title: "Test", body: "Body" });

    expect(mockDelete).toHaveBeenCalled();
  });
});
