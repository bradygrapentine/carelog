import { inngest } from "../client";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";
import { sendPushToOrgCoordinators } from "../pushNotification";

// ─── pure detection logic (testable without Inngest) ─────────────────────────

export interface CheckInRow {
  user_id: string;
  org_id: string;
  week_stamp: string;
  stress_score: number;
}

/**
 * Returns user_ids whose stress_score was >= 4 for 2 or more consecutive weeks
 * among the provided check-ins. Input is expected to be sorted by week_stamp DESC.
 */
export function detectBurnoutRisk(checkins: CheckInRow[]): string[] {
  // Group by user_id
  const byUser = new Map<string, CheckInRow[]>();
  for (const row of checkins) {
    const existing = byUser.get(row.user_id) ?? [];
    existing.push(row);
    byUser.set(row.user_id, existing);
  }

  const atRisk: string[] = [];

  for (const [userId, rows] of byUser) {
    // Sort by week_stamp ascending to find consecutive streaks
    const sorted = [...rows].sort((a, b) =>
      a.week_stamp.localeCompare(b.week_stamp),
    );

    let consecutive = 0;
    for (const row of sorted) {
      if (row.stress_score >= 4) {
        consecutive++;
        if (consecutive >= 2) {
          atRisk.push(userId);
          break;
        }
      } else {
        consecutive = 0;
      }
    }
  }

  return atRisk;
}

/**
 * TD-212: decide which at-risk users get a NEW burnout alert, deduped per org
 * per week. A burnout alert is one-per-org-per-week, so given the at-risk users,
 * their org map, and the set of orgs already alerted this week (from one batched
 * query — not N per-user reads), return the ordered (userId, orgId) pairs to
 * insert. Users with no org are skipped; the first at-risk user wins an org and
 * later same-org users are skipped (deterministic — the prior per-user DB read
 * inside Promise.all was racy). Pure + synchronous so it is unit-testable.
 */
export function selectBurnoutAlertInserts(
  atRiskUserIds: string[],
  userOrgMap: Map<string, string>,
  alreadyAlertedOrgs: Set<string>,
): { userId: string; orgId: string }[] {
  const seen = new Set<string>(alreadyAlertedOrgs);
  const inserts: { userId: string; orgId: string }[] = [];
  for (const userId of atRiskUserIds) {
    const orgId = userOrgMap.get(userId);
    if (!orgId) continue;
    if (seen.has(orgId)) continue;
    seen.add(orgId);
    inserts.push({ userId, orgId });
  }
  return inserts;
}

// ─── Inngest function ─────────────────────────────────────────────────────────

export const burnoutAlert = inngest.createFunction(
  { id: "burnout-alert" },
  { cron: "TZ=UTC 0 8 * * 1" }, // Weekly Monday 8am UTC (after weekly digest)
  async ({ step, logger }) => {
    try {
      const today = new Date();

      // Compute ISO week stamp for this run (used for idempotency key in alert payload)
      function computeWeekStamp(d: Date): string {
        const date = new Date(
          Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
        );
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const week = Math.ceil(
          ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
        );
        return date.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
      }
      const alertWeekStamp = computeWeekStamp(today);

      // Step 1: fetch the last 3 weeks of check-ins (per-org via created_at filter)
      const threeWeeksAgo = new Date(today);
      threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
      const cutoff = threeWeeksAgo.toISOString();

      const recentCheckins = await step.run(
        "fetch-recent-checkins",
        async () => {
          const { data, error } = await supabaseAdmin
            .from("burnout_checkins")
            .select("user_id, org_id, week_stamp, stress_score")
            .gte("created_at", cutoff)
            .order("week_stamp", { ascending: false })
            .limit(500); // generous upper bound; we filter in detectBurnoutRisk

          if (error) throw new Error("Query failed: " + error.message);
          return (data ?? []) as CheckInRow[];
        },
      );

      logger.info("Recent check-ins fetched: " + recentCheckins.length);

      const atRiskUserIds = detectBurnoutRisk(recentCheckins);
      logger.info("Caregivers at burnout risk: " + atRiskUserIds.length);

      if (atRiskUserIds.length === 0) {
        await supabaseAdmin.from("cron_runs").upsert({
          function_id: "burnout-alert",
          last_ran_at: new Date().toISOString(),
          last_status: "ok",
          error_message: null,
        });
        return { alerts: 0 };
      }

      // Build a map of user_id → org_id for alert creation
      const userOrgMap = new Map<string, string>();
      for (const row of recentCheckins) {
        if (!userOrgMap.has(row.user_id)) {
          userOrgMap.set(row.user_id, row.org_id);
        }
      }

      let totalAlerts = 0;

      // TD-212: dedup is per-org-per-week. Batch the "alert already exists" check
      // into ONE query before the per-user fan-out instead of N round-trips inside
      // each step.run. Seed an in-memory set of already-alerted orgs; the fan-out
      // below adds to it on insert-decision so two at-risk users in the SAME org
      // within this run can't double-insert (the prior per-user read was racy
      // under Promise.all). Retry caveat: this step + the inserts memoize, so the
      // snapshot reflects pre-run rows + this-run decisions, not a re-read.
      const atRiskOrgIds = Array.from(
        new Set(
          atRiskUserIds
            .map((userId) => userOrgMap.get(userId))
            .filter((o): o is string => Boolean(o)),
        ),
      );

      const alertedOrgs = await step.run("fetch-existing-alerts", async () => {
        if (atRiskOrgIds.length === 0) return [] as string[];
        const { data, error } = await supabaseAdmin
          .from("care_events")
          .select("org_id")
          .in("org_id", atRiskOrgIds)
          .eq("event_type", "task")
          .eq("entry_kind", "system")
          .filter("payload->>burnout_risk", "eq", "true")
          .filter("payload->>week_stamp", "eq", alertWeekStamp);

        if (error)
          throw new Error("Existing-alert query failed: " + error.message);
        return Array.from(new Set((data ?? []).map((r) => r.org_id as string)));
      });

      // Deduped per-org insert list (pure decision — see selectBurnoutAlertInserts).
      const toInsert = selectBurnoutAlertInserts(
        atRiskUserIds,
        userOrgMap,
        new Set(alertedOrgs),
      );

      await Promise.all(
        toInsert.map(({ userId, orgId }) =>
          step.run("alert-" + userId, async () => {
            await supabaseAdmin.from("care_events").insert({
              org_id: orgId,
              // No recipient_id — this is a caregiver wellbeing event, not recipient-scoped
              // recipient_id is nullable on care_events for system events
              event_type: "task",
              entry_kind: "system",
              occurred_at: today.toISOString(),
              flagged: false,
              payload: {
                burnout_risk: true,
                // Omit user_id — care_events is readable by all org members; use burnout.orgSummary for per-user data
                week_stamp: alertWeekStamp,
                note: "A caregiver in this org has had high stress scores for 2+ consecutive weeks.",
              },
            });

            totalAlerts++;
            logger.info("Burnout alert created for user " + userId);
            try {
              await sendPushToOrgCoordinators(orgId, {
                title: "Caregiver wellbeing alert",
                body: "A team member has had high stress for 2+ weeks. Check in with your team.",
                data: { screen: "team" },
              });
            } catch (pushErr) {
              logger.warn(
                "Push failed for burnout alert user " +
                  userId +
                  ": " +
                  String(pushErr),
              );
            }
          }),
        ),
      );

      await supabaseAdmin.from("cron_runs").upsert({
        function_id: "burnout-alert",
        last_ran_at: new Date().toISOString(),
        last_status: "ok",
        error_message: null,
      });

      return { alerts: totalAlerts };
    } catch (err) {
      await supabaseAdmin.from("cron_runs").upsert({
        function_id: "burnout-alert",
        last_ran_at: new Date().toISOString(),
        last_status: "error",
        error_message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
);
