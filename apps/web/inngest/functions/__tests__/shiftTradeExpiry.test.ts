// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/repositories/shiftTradeRequestsRepository", () => ({
  expireStaleRequests: vi.fn(),
}));

vi.mock("@/inngest/pushNotification", () => ({
  sendPushToUser: vi.fn(),
}));

vi.mock("@/server/supabaseAdmin.server", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { handleExpiry } from "../shiftTradeExpiry";
import { expireStaleRequests } from "@/server/repositories/shiftTradeRequestsRepository";
import { sendPushToUser } from "@/inngest/pushNotification";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";

describe("handleExpiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result when no expired requests", async () => {
    vi.mocked(expireStaleRequests).mockResolvedValue({ expiredIds: [] });

    const result = await handleExpiry();

    expect(result).toEqual({ expired: 0 });
    expect(vi.mocked(sendPushToUser)).not.toHaveBeenCalled();
  });

  it("sends push notifications for expired trade requests", async () => {
    const tradeId1 = "trade-123";
    const tradeId2 = "trade-456";
    const userId1 = "user-abc";
    const userId2 = "user-def";

    vi.mocked(expireStaleRequests).mockResolvedValue({
      expiredIds: [tradeId1, tradeId2],
    });

    const selectMock = vi.fn();
    const eqMock = vi.fn();
    const singleMock = vi.fn();

    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ single: singleMock });

    // First call returns userId1, second call returns userId2
    singleMock
      .mockResolvedValueOnce({ data: { requested_by: userId1 } })
      .mockResolvedValueOnce({ data: { requested_by: userId2 } });

    vi.mocked(supabaseAdmin).from.mockReturnValue({
      select: selectMock,
    } as any);

    const result = await handleExpiry();

    expect(result).toEqual({ expired: 2 });
    expect(vi.mocked(expireStaleRequests)).toHaveBeenCalledOnce();
    expect(vi.mocked(sendPushToUser)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendPushToUser)).toHaveBeenNthCalledWith(1, userId1, {
      title: "Trade request expired",
      body: "Your shift trade request was not accepted in time.",
      data: { type: "trade_expired", tradeRequestId: tradeId1 },
    });
    expect(vi.mocked(sendPushToUser)).toHaveBeenNthCalledWith(2, userId2, {
      title: "Trade request expired",
      body: "Your shift trade request was not accepted in time.",
      data: { type: "trade_expired", tradeRequestId: tradeId2 },
    });
  });

  it("skips notification when supabase lookup fails for a trade", async () => {
    const tradeId1 = "trade-123";
    const tradeId2 = "trade-456";
    const userId2 = "user-def";

    vi.mocked(expireStaleRequests).mockResolvedValue({
      expiredIds: [tradeId1, tradeId2],
    });

    const selectMock = vi.fn();
    const eqMock = vi.fn();
    const singleMock = vi.fn();

    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ single: singleMock });

    // First call returns null/missing, second call succeeds
    singleMock
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { requested_by: userId2 } });

    vi.mocked(supabaseAdmin).from.mockReturnValue({
      select: selectMock,
    } as any);

    const result = await handleExpiry();

    expect(result).toEqual({ expired: 2 });
    expect(vi.mocked(sendPushToUser)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendPushToUser)).toHaveBeenCalledWith(userId2, {
      title: "Trade request expired",
      body: "Your shift trade request was not accepted in time.",
      data: { type: "trade_expired", tradeRequestId: tradeId2 },
    });
  });
});
