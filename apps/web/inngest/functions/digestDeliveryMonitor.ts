/**
 * TD-74 — Weekly digest delivery monitoring
 *
 * Runs Sunday at noon UTC (4 hours after the digest send window that starts ~8am).
 * Compares successful weeklyDigest cron_runs against total org count.
 * If success rate < 80%, fires a Sentry alert.
 *
 * NOTE: cron_runs has one row per function_id (upsert by PK), so it records
 * only the most recent run outcome for weeklyDigest. "Success this week" is
 * inferred from last_status = 'ok' AND last_ran_at falling within the
 * current ISO week. This is sufficient for a canary-level alert.
 */

import * as Sentry from "@sentry/nextjs";
import { inngest } from "../client";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";

// ─── Pure logic (testable without Inngest) ────────────────────────────────────

/**
 * Compute ISO week stamp for a given Date, e.g. "2026-W17".
 * Reusable across monitor functions.
 */
export function computeWeekStamp(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return date.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

export type DeliveryMetrics = {
  org_count: number;
  success_count: number;
};

/**
 * Returns true when digest delivery success rate is below 80%.
 * Returns false (no alert) when org_count is 0 — nothing to deliver to.
 */
export function belowDeliveryThreshold(metrics: DeliveryMetrics): boolean {
  if (metrics.org_count <= 0) return false;
  return metrics.success_count / metrics.org_count < 0.8;
}

// ─── Inngest function ─────────────────────────────────────────────────────────

export const digestDeliveryMonitor = inngest.createFunction(
  { id: "digest-delivery-monitor" },
  { cron: "TZ=UTC 0 12 * * 0" }, // Every Sunday at noon UTC
  async ({ step, logger }) => {
    const now = new Date();
    const weekStamp = computeWeekStamp(now);
    const idempotencyKey = `digest-monitor:${weekStamp}`;

    try {
      const metrics = await step.run(
        "check-delivery-metrics",
        async (): Promise<DeliveryMetrics> => {
          // Count all organizations
          const { count: orgCount, error: orgError } = await supabaseAdmin
            .from("organizations")
            .select("id", { count: "exact", head: true });

          if (orgError)
            throw new Error("Org count query failed: " + orgError.message);

          // Check whether weeklyDigest ran successfully this week.
          // cron_runs has one row per function_id (latest run). We check that:
          //   1. last_status = 'ok'
          //   2. last_ran_at is within the current ISO week (Monday 00:00 UTC to now)
          //
          // Week start = most recent Monday 00:00 UTC
          const weekStart = new Date(now);
          weekStart.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
          weekStart.setUTCHours(0, 0, 0, 0);

          const { data: cronRow, error: cronError } = await supabaseAdmin
            .from("cron_runs")
            .select("last_status, last_ran_at")
            .eq("function_id", "weekly-digest")
            .single();

          if (cronError && cronError.code !== "PGRST116") {
            // PGRST116 = row not found — that's a valid "never ran" state
            throw new Error("cron_runs query failed: " + cronError.message);
          }

          const digestRanThisWeek =
            cronRow?.last_status === "ok" &&
            cronRow.last_ran_at != null &&
            new Date(cronRow.last_ran_at) >= weekStart;

          // success_count is 0 or 1 at function granularity.
          // We compare against org_count: if the digest ran at all (success), treat
          // all orgs as covered (weeklyDigest fans out internally to each org).
          const successCount = digestRanThisWeek ? (orgCount ?? 0) : 0;

          return {
            org_count: orgCount ?? 0,
            success_count: successCount,
          };
        },
      );

      logger.info(
        `digest-delivery-monitor: org_count=${metrics.org_count} ` +
          `success_count=${metrics.success_count} week=${weekStamp} ` +
          `idempotency=${idempotencyKey}`,
      );

      if (belowDeliveryThreshold(metrics)) {
        const rate =
          metrics.org_count > 0
            ? ((metrics.success_count / metrics.org_count) * 100).toFixed(1)
            : "0";

        Sentry.captureMessage(
          `Weekly digest delivery below 80%: ${rate}% success for week ${weekStamp}`,
          {
            level: "warning",
            tags: {
              idempotency_key: idempotencyKey,
              monitor: "digest-delivery",
              week_stamp: weekStamp,
            },
            extra: {
              org_count: metrics.org_count,
              success_count: metrics.success_count,
              rate_pct: rate,
            },
          },
        );

        logger.warn(
          `digest-delivery-monitor: ALERT fired — ${rate}% delivery rate for ${weekStamp}`,
        );
      }

      await supabaseAdmin.from("cron_runs").upsert({
        function_id: "digest-delivery-monitor",
        last_ran_at: now.toISOString(),
        last_status: "ok",
        error_message: null,
      });

      return {
        org_count: metrics.org_count,
        success_count: metrics.success_count,
        week_stamp: weekStamp,
        alerted: belowDeliveryThreshold(metrics),
      };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { inngest_function: "digest-delivery-monitor" },
      });
      await supabaseAdmin.from("cron_runs").upsert({
        function_id: "digest-delivery-monitor",
        last_ran_at: now.toISOString(),
        last_status: "error",
        error_message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
);
