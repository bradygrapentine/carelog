import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendPushToUser } from "../pushNotification";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock("../../server/supabaseAdmin.server", () => ({
  supabaseAdmin: { from: mockFrom },
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
