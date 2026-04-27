/**
 * TD-73 — Production rate-limit dashboard
 *
 * Runs every 5 minutes and checks for HTTP 429 spikes on /api/auth/* and /api/trpc/*.
 *
 * NOTE: This function is currently a STUB. The project does not yet have a
 * rate-limit-counter table or an ingestion pipeline that records per-request
 * HTTP status codes into Supabase. The `cron_runs` table only records
 * Inngest function outcomes, not HTTP-level request metrics.
 *
 * FOLLOW-UP TD REQUIRED (see PR description):
 *   Add a `rate_limit_events` table (or Vercel Log Drain integration) that
 *   captures HTTP 429 events with endpoint + timestamp so this monitor can
 *   perform the 1%-threshold query described in TD-73.
 *
 * Until that infra exists this function:
 *   1. Logs a console.warn so the absence is visible in Vercel function logs.
 *   2. Records a successful cron_run so the monitor appears in observability dashboards.
 *   3. Returns { status: 'stub', reason: 'missing rate_limit_events table' }.
 */

import * as Sentry from "@sentry/nextjs";
import { inngest } from "../client";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";

// ─── Pure detection logic (testable without Inngest) ─────────────────────────

export type RateLimitWindow = {
  total_requests: number;
  requests_429: number;
  window_stamp: string;
};

/**
 * Returns true when the 429 rate exceeds 1% of total requests.
 * Both counts must be > 0 to avoid false positives on empty windows.
 */
export function exceeds429Threshold(window: RateLimitWindow): boolean {
  if (window.total_requests <= 0) return false;
  return window.requests_429 / window.total_requests > 0.01;
}

// ─── Inngest function ─────────────────────────────────────────────────────────

export const rateLimit429Monitor = inngest.createFunction(
  { id: "rate-limit-429-monitor" },
  { cron: "TZ=UTC */5 * * * *" }, // Every 5 minutes
  async ({ logger }) => {
    // 5-minute bucket stamp (e.g. "2026-04-25T08:20")
    const now = new Date();
    const minuteFloor = Math.floor(now.getUTCMinutes() / 5) * 5;
    const windowStamp =
      now.toISOString().slice(0, 13) +
      ":" +
      String(minuteFloor).padStart(2, "0");
    const idempotencyKey = `ratelimit-alert:${windowStamp}`;

    try {
      // STUB: rate_limit_events table does not exist yet.
      // When it is created, replace this block with a real query:
      //
      //   const { data } = await supabaseAdmin
      //     .from('rate_limit_events')
      //     .select('status_code, endpoint')
      //     .gte('occurred_at', new Date(now.getTime() - 5 * 60 * 1000).toISOString())
      //     .in('endpoint', ['/api/auth', '/api/trpc'])
      //
      //   const total = data?.length ?? 0
      //   const hits429 = data?.filter(r => r.status_code === 429).length ?? 0
      //   const window: RateLimitWindow = { total_requests: total, requests_429: hits429, window_stamp: windowStamp }
      //
      //   if (exceeds429Threshold(window)) {
      //     Sentry.captureMessage(`Rate-limit spike: ${hits429}/${total} (${((hits429/total)*100).toFixed(1)}%) 429s in ${windowStamp}`, {
      //       level: 'warning',
      //       tags: { idempotency_key: idempotencyKey, monitor: 'rate-limit-429' },
      //     })
      //   }

      console.warn(
        `[TD-73 STUB] rateLimit429Monitor ran at ${now.toISOString()} (window: ${windowStamp}). ` +
          "Missing infra: rate_limit_events table not yet created. " +
          "See PR description for follow-up TD row.",
      );

      logger.info(
        `rate-limit-429-monitor: stub run, idempotency=${idempotencyKey}`,
      );

      await supabaseAdmin.from("cron_runs").upsert({
        function_id: "rate-limit-429-monitor",
        last_ran_at: now.toISOString(),
        last_status: "ok",
        error_message: null,
      });

      return {
        status: "stub",
        reason: "missing rate_limit_events table",
        window_stamp: windowStamp,
      };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { inngest_function: "rate-limit-429-monitor" },
      });
      await supabaseAdmin.from("cron_runs").upsert({
        function_id: "rate-limit-429-monitor",
        last_ran_at: now.toISOString(),
        last_status: "error",
        error_message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
);
