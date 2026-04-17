import * as Sentry from "@sentry/nextjs";
import { inngest } from "../client";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";
import { expireStaleRequests } from "../../server/repositories/shiftTradeRequestsRepository";
import { sendPushToUser } from "../pushNotification";

/**
 * Exported for unit testing.
 * Expires stale shift trade requests and sends push notifications to requesters.
 */
export async function handleExpiry() {
  const { expiredIds } = await expireStaleRequests();

  for (const id of expiredIds) {
    const { data } = await supabaseAdmin
      .from("shift_trade_requests")
      .select("requested_by")
      .eq("id", id)
      .single();

    if (data?.requested_by) {
      await sendPushToUser(data.requested_by, {
        title: "Trade request expired",
        body: "Your shift trade request was not accepted in time.",
        data: { type: "trade_expired", tradeRequestId: id },
      });
    }
  }

  return { expired: expiredIds.length };
}

export const shiftTradeExpiry = inngest.createFunction(
  { id: "shift-trade-expiry" },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step, logger }) => {
    try {
      return await step.run("expire-stale-trades", async () => {
        const result = await handleExpiry();
        logger.info(`Expired ${result.expired} stale trade requests`);
        return result;
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { inngest_function: "shift-trade-expiry" },
      });
      throw err;
    }
  },
);
