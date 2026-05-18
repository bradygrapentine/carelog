import { inngest } from "../client";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";
import { resend } from "../../server/resend.server";
import {
  getRefillRecipients,
  type RefillRecipient,
} from "../../server/repositories/membershipsRepository";
import { isoWeekStamp } from "@carelog/utils";
import * as Sentry from "@sentry/nextjs";

// ─── pure detection logic (testable without Inngest) ─────────────────────────

export interface MedicationRow {
  id: string;
  org_id: string;
  recipient_id: string;
  drug_name: string;
  supply_days_remaining: number;
  pharmacy: string | null;
  pharmacy_phone: string | null;
}

export function detectLowSupply(medications: MedicationRow[]): MedicationRow[] {
  return medications.filter((m) => m.supply_days_remaining <= 7);
}

// ─── ON-71 Phase 2: batching + email body ────────────────────────────────────

export type RefillBatch = {
  org_id: string;
  recipient_id: string;
  medications: MedicationRow[];
};

/** Group low-supply medications by (org_id, recipient_id). Single email per group. */
export function batchByOrgRecipient(
  medications: MedicationRow[],
): RefillBatch[] {
  const map = new Map<string, RefillBatch>();
  for (const med of medications) {
    const key = med.org_id + "|" + med.recipient_id;
    let batch = map.get(key);
    if (!batch) {
      batch = {
        org_id: med.org_id,
        recipient_id: med.recipient_id,
        medications: [],
      };
      map.set(key, batch);
    }
    batch.medications.push(med);
  }
  return Array.from(map.values());
}

/** Plain-text email body. NEVER HTML (closes XSS surface — threat model H4). */
export function buildRefillEmailBody(batch: RefillBatch): string {
  const lines: string[] = [];
  lines.push("A refill may be needed soon for your care recipient.");
  lines.push("");
  lines.push("Low-supply medications (7 days or fewer remaining):");
  lines.push("");
  for (const med of batch.medications) {
    lines.push(
      "- " + med.drug_name + " — " + med.supply_days_remaining + " days left",
    );
    if (med.pharmacy) lines.push("    Pharmacy: " + med.pharmacy);
    if (med.pharmacy_phone)
      lines.push("    Pharmacy phone: " + med.pharmacy_phone);
  }
  lines.push("");
  lines.push(
    'To stop receiving these reminders, reply to this email with "unsubscribe".',
  );
  return lines.join("\n");
}

/** Compose the dedup_key for refill emails. */
export function refillDedupKey(
  orgId: string,
  recipientId: string,
  week: string,
): string {
  return "refill:" + orgId + ":" + recipientId + ":" + week;
}

// ─── Inngest function ─────────────────────────────────────────────────────────

export const refillAlert = inngest.createFunction(
  { id: "refill-alert" },
  { cron: "TZ=UTC 0 7 * * *" }, // Daily at 7am UTC (1 hour after gap detector)
  async ({ step, logger }) => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const week = isoWeekStamp(today);

      // ── Step 0 (M1/M5): sweep stale pending rows ────────────────────────────
      // Inngest step crash between INSERT and Resend send could leave a pending
      // row forever, blocking future weeks. Sweep rows older than 15 min where
      // sent_at IS NULL.
      await step.run("sweep-pending-refill-dispatch", async () => {
        const cutoff = new Date(today.getTime() - 15 * 60 * 1000).toISOString();
        const { error } = await supabaseAdmin
          .from("email_dispatch_log")
          .delete()
          .eq("kind", "refill")
          .is("sent_at", null)
          .lt("created_at", cutoff);
        if (error) {
          // Defense-in-depth: don't block the rest of the cron on a sweep failure.
          // PHI-clean Sentry capture: only generic component/path tags.
          Sentry.captureException(error, {
            tags: { component: "inngest.refillAlert", path: "sweep.error" },
          });
        }
      });

      // Step 1: fetch all active medications with low supply
      const allMedications = await step.run(
        "fetch-low-supply-medications",
        async () => {
          const { data, error } = await supabaseAdmin
            .from("medications")
            .select(
              "id, org_id, recipient_id, drug_name, supply_days_remaining, pharmacy, pharmacy_phone",
            )
            .lte("supply_days_remaining", 7)
            .is("archived_at", null);
          if (error) throw error;
          return (data ?? []) as MedicationRow[];
        },
      );

      let totalAlerts = 0;
      let totalEmails = 0;

      // ── Phase 1 (existing): per-medication care_event audit insert ──────────
      await Promise.all(
        allMedications.map((med) =>
          step.run("alert-" + med.id, async () => {
            const todayStart = todayStr + "T00:00:00Z";

            const { data: existing } = await supabaseAdmin
              .from("care_events")
              .select("id")
              .eq("org_id", med.org_id)
              .eq("recipient_id", med.recipient_id)
              .eq("event_type", "task")
              .eq("entry_kind", "system")
              .filter("payload->>refill_needed", "eq", "true")
              .filter("payload->>medication_id", "eq", med.id)
              .gte("occurred_at", todayStart)
              .limit(1);

            if (existing && existing.length > 0) {
              logger.info(
                "Refill alert already exists for medication " +
                  med.id +
                  " today — skipping",
              );
              return;
            }

            await supabaseAdmin.from("care_events").insert({
              org_id: med.org_id,
              recipient_id: med.recipient_id,
              event_type: "task",
              entry_kind: "system",
              occurred_at: today.toISOString(),
              flagged: false,
              payload: {
                refill_needed: true,
                medication_id: med.id,
                drug_name: med.drug_name,
                days_remaining: med.supply_days_remaining,
              },
            });

            totalAlerts++;
          }),
        ),
      );

      // ── Phase 2 (NEW): batched email dispatch per (org_id, recipient_id) ────
      // H2: 5 low-supply meds × 3 coordinators = 3 emails (not 15). M1/M5: write
      // the dedup row BEFORE calling Resend so retries hit the unique constraint
      // and skip. M2: any captureException uses generic tags only — no email
      // body / drug name / `to` address leaks to Sentry.
      const batches = batchByOrgRecipient(allMedications);
      await Promise.all(
        batches.map((batch) =>
          step.run(
            "dispatch-" + batch.org_id + "-" + batch.recipient_id,
            async () => {
              const dedupKey = refillDedupKey(
                batch.org_id,
                batch.recipient_id,
                week,
              );

              // (c) INSERT first. On 23505 (unique violation), another worker
              //     already owns this slot or this week was already sent. Skip.
              const { data: inserted, error: insertError } = await supabaseAdmin
                .from("email_dispatch_log")
                .insert({
                  org_id: batch.org_id,
                  recipient_id: batch.recipient_id,
                  kind: "refill",
                  dedup_key: dedupKey,
                })
                .select("id")
                .single();

              if (insertError) {
                const code = (insertError as { code?: string }).code;
                if (code === "23505") {
                  logger.info(
                    "Refill email already dispatched or in-flight for " +
                      batch.org_id +
                      "/" +
                      batch.recipient_id +
                      " — skipping",
                  );
                  return;
                }
                // Real DB error — fail fast so Inngest retries. PHI-clean.
                Sentry.captureException(insertError, {
                  tags: {
                    component: "inngest.refillAlert",
                    path: "dispatch.insert.error",
                  },
                });
                throw insertError;
              }

              // (d) Build email + dispatch. NEVER include pharmacy / drug names
              //     in subject/headers — only in plain-text body (H3/H4).
              if (!resend) {
                logger.warn(
                  "RESEND_API_KEY not set — skipping email for " +
                    batch.org_id +
                    "/" +
                    batch.recipient_id,
                );
                return;
              }

              const recipients = await getRefillRecipients(
                batch.org_id,
                batch.recipient_id,
              );
              if (recipients.length === 0) {
                logger.info(
                  "No active refill recipients for " +
                    batch.org_id +
                    "/" +
                    batch.recipient_id +
                    " — skipping email",
                );
                return;
              }
              // Deduplicate emails (coordinator + caregiver could share a user).
              const uniqueEmails = Array.from(
                new Set(recipients.map((r: RefillRecipient) => r.email)),
              );

              const body = buildRefillEmailBody(batch);

              try {
                await resend.emails.send({
                  from:
                    process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
                  to: uniqueEmails,
                  subject: "Refill reminders from CareSync",
                  text: body,
                  headers: {
                    "List-Unsubscribe":
                      "<mailto:support@care-log.org?subject=unsubscribe-refill>",
                  },
                });
              } catch (sendError) {
                // (f) Leave dedup row pending. Next-tick sweep (>15 min later)
                //     will clear it; until then, retries hit unique violation
                //     and skip. Trade-off: one failed send = no email this week.
                Sentry.captureException(sendError, {
                  tags: {
                    component: "inngest.refillAlert",
                    path: "resend.error",
                  },
                });
                throw sendError;
              }

              // (e) Mark row sent_at = now() — it is now permanent. Retries past
              //     this point hit unique violation and correctly skip.
              await supabaseAdmin
                .from("email_dispatch_log")
                .update({ sent_at: new Date().toISOString() })
                .eq("id", inserted.id);

              totalEmails++;
              logger.info(
                "Refill email dispatched to " +
                  uniqueEmails.length +
                  " addresses for " +
                  batch.org_id +
                  "/" +
                  batch.recipient_id,
              );
            },
          ),
        ),
      );

      await supabaseAdmin.from("cron_runs").upsert({
        function_id: "refill-alert",
        last_ran_at: new Date().toISOString(),
        last_status: "ok",
        error_message: null,
      });

      return { alerts: totalAlerts, emails: totalEmails };
    } catch (err) {
      await supabaseAdmin.from("cron_runs").upsert({
        function_id: "refill-alert",
        last_ran_at: new Date().toISOString(),
        last_status: "error",
        error_message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
);
