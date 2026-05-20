"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatClockTime } from "@/lib/format";
import { MedScheduleStrip } from "@/components/medications/MedScheduleStrip";
import { AdherenceChart } from "@/components/medications/AdherenceChart";
import { MedAttentionHero } from "@/components/medications/MedAttentionHero";
import { MedStatusBadge } from "@/components/medications/MedStatusBadge";
import { RxGlyph } from "@/components/medications/RxGlyph";
import {
  buildAdherenceDays,
  buildStripDoses,
} from "@/lib/medAdherenceFromEvents";

type MedCardProps = {
  /** UUID of the recipient whose meds to show. Required for real data; omit to skip queries (stub/placeholder mode). */
  recipientId?: string;
  /** UUID of the org. Required for real data; omit to skip queries (stub/placeholder mode). */
  orgId?: string;
  /** Override "now" — only used by tests for deterministic missed-dose / hour math. */
  now?: Date;
};

export function MedCard({
  recipientId,
  orgId,
  now: nowOverride,
}: MedCardProps) {
  const enabled = !!recipientId && !!orgId;

  const {
    data: scheduled,
    isLoading: schedulesLoading,
    isError: schedulesError,
  } = trpc.medications.listScheduled.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled },
  );

  const {
    data: takenLog,
    isLoading: logLoading,
    isError: logError,
  } = trpc.medications.todayLog.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled },
  );

  const { data: weekData } = trpc.medications.weekData.useQuery(
    { org_id: orgId ?? "", recipient_id: recipientId ?? "" },
    { enabled },
  );

  const utils = trpc.useUtils();

  // TD-211: anchor "now" once at mount. Calling `new Date()` inside useMemo /
  // render bodies is a React 19 purity violation (hard lint error) and re-reads
  // the clock on every render. The lazy useState initializer freezes it for the
  // card's lifetime; the helpers + memos below close over this stable value.
  const [now] = useState(() => nowOverride ?? new Date());

  const logMutation = trpc.medications.logAdministration.useMutation({
    onSuccess: () => {
      utils.medications.todayLog.invalidate({
        org_id: orgId ?? "",
        recipient_id: recipientId ?? "",
      });
    },
  });

  // Build a set of taken medication_ids from today's log
  const takenIds = useMemo(() => {
    if (!takenLog) return new Set<string>();
    return new Set(
      takenLog.filter((e) => e.action === "given").map((e) => e.medication_id),
    );
  }, [takenLog]);

  type MedRow = {
    scheduleId: string;
    medId: string;
    name: string;
    dose: string;
    timeLabel: string;
    scheduledTime: string;
    taken: boolean;
  };

  // Build the rows from scheduled doses
  const rows = useMemo<MedRow[]>(() => {
    if (!scheduled) return [];
    const result: MedRow[] = [];
    for (const s of scheduled) {
      const med = Array.isArray(s.medications)
        ? s.medications[0]
        : s.medications;
      if (!med) continue;
      result.push({
        scheduleId: s.id,
        medId: med.id,
        name: med.drug_name,
        dose: med.dosage,
        timeLabel: formatClockTime(s.scheduled_time),
        scheduledTime: s.scheduled_time,
        taken: takenIds.has(med.id),
      });
    }
    return result;
  }, [scheduled, takenIds]);

  const isLoading = schedulesLoading || logLoading;
  const isError = schedulesError || logError;
  const takenCount = rows.filter((r) => r.taken).length;

  function isPastScheduledTime(hms: string): boolean {
    const [h, m] = hms.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return false;
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    return h * 60 + m < minutesNow;
  }

  function rowStatus(row: MedRow): "on-track" | "missed" | null {
    if (row.taken) return "on-track";
    if (isPastScheduledTime(row.scheduledTime)) return "missed";
    return null;
  }

  const missedDoses = useMemo(
    () =>
      rows
        .filter((r) => !r.taken && isPastScheduledTime(r.scheduledTime))
        .map((r) => ({
          medName: `${r.name} ${r.dose}`,
          scheduledTime: r.timeLabel,
          medId: r.medId,
          rawScheduledTime: r.scheduledTime,
        })),
    [rows, now],
  );

  const stripDoses = useMemo(() => {
    if (!weekData) return [];
    const today = now;
    const todayDow = today.getUTCDay();
    const todayStartMs = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const todayEvents = weekData.events.filter((e) => {
      const ts = Date.parse(e.occurred_at);
      return ts >= todayStartMs && ts < todayStartMs + 24 * 60 * 60 * 1000;
    });
    const enriched = weekData.schedules
      .filter((s) => s.days_of_week?.includes(todayDow))
      .map((s) => {
        const med = scheduled?.find((row) => {
          const m = Array.isArray(row.medications)
            ? row.medications[0]
            : row.medications;
          return m?.id === s.medication_id;
        });
        const m = med
          ? Array.isArray(med.medications)
            ? med.medications[0]
            : med.medications
          : null;
        return {
          ...s,
          drug_name: m?.drug_name,
          dosage: m?.dosage,
        };
      });
    return buildStripDoses(enriched, todayEvents, today);
  }, [weekData, scheduled, now]);

  const adherenceDays = useMemo(() => {
    if (!weekData) return [];
    return buildAdherenceDays(weekData.schedules, weekData.events);
  }, [weekData]);

  const nowHour = useMemo(() => {
    return now.getHours() + now.getMinutes() / 60;
  }, [now]);

  function handleLog(medId: string, scheduledTime: string) {
    if (!orgId || !recipientId) return;
    logMutation.mutate({
      org_id: orgId,
      recipient_id: recipientId,
      medication_id: medId,
      scheduled_time: scheduledTime,
      action: "given",
    });
  }

  return (
    <section
      aria-labelledby="meds-card-heading"
      className="rounded-xl border border-[var(--color-border)] bg-card p-5 shadow-sm"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          id="meds-card-heading"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]"
        >
          <RxGlyph
            size={18}
            className="text-[var(--color-primary)]"
            ariaLabel="Medications"
          />
          Medications
        </h2>
        {!isLoading && !isError && rows.length > 0 && (
          <span className="eyebrow-mono">
            {takenCount} / {rows.length} logged
          </span>
        )}
      </div>

      {!isLoading && !isError && missedDoses.length > 0 && (
        <div className="mb-4">
          <MedAttentionHero
            missedDoses={missedDoses.map((d) => ({
              medName: d.medName,
              scheduledTime: d.scheduledTime,
            }))}
            onRecordCatchUp={(medName) => {
              const dose = missedDoses.find((d) => d.medName === medName);
              if (dose) handleLog(dose.medId, dose.rawScheduledTime);
            }}
          />
        </div>
      )}

      {isLoading && (
        <ul className="space-y-2" aria-label="Loading medications">
          {[1, 2, 3].map((i) => (
            <li
              key={i}
              data-testid="med-row-skeleton"
              className="flex animate-pulse items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2"
            >
              <span className="h-5 w-5 shrink-0 rounded-full bg-[var(--color-border)]" />
              <span className="h-3 w-10 rounded bg-[var(--color-border)]" />
              <span className="h-3 flex-1 rounded bg-[var(--color-border)]" />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && isError && (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          Could not load medications. Please refresh.
        </p>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <p className="text-sm text-[var(--color-muted)]">
          No medications tracked yet.{" "}
          <a
            href="/medications"
            className="text-[var(--color-primary)] underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Add one in Medications →
          </a>
        </p>
      )}

      {!isLoading && !isError && stripDoses.length > 0 && (
        <div className="mb-4">
          <MedScheduleStrip doses={stripDoses} now={nowHour} />
        </div>
      )}

      {!isLoading && !isError && adherenceDays.length > 0 && (
        <div className="mb-4">
          <AdherenceChart days={adherenceDays} />
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((med) => (
            <li
              key={med.scheduleId}
              data-testid="med-row"
              data-med-id={med.medId}
              data-taken={med.taken ? "true" : "false"}
              className={[
                "flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2",
                med.taken ? "opacity-60" : "bg-card",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                // A11Y-021: icon-only checkmark, WCAG 1.4.11 non-text 3:1 ✓
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  med.taken
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-border)]",
                ].join(" ")}
              >
                {med.taken && <Check className="h-3 w-3" aria-hidden="true" />}
              </span>

              <span className="eyebrow-mono w-12 shrink-0">
                {med.timeLabel}
              </span>

              <span
                data-testid="med-name"
                className={[
                  "min-w-0 flex-1 truncate text-sm text-[var(--color-ink)]",
                  med.taken ? "line-through" : "",
                ].join(" ")}
              >
                {med.name}{" "}
                <span className="text-[var(--color-muted)]">· {med.dose}</span>
              </span>

              {(() => {
                const status = rowStatus(med);
                return status ? (
                  <MedStatusBadge status={status} className="shrink-0" />
                ) : null;
              })()}

              {!med.taken && (
                <button
                  type="button"
                  data-testid="med-log-btn"
                  onClick={() => handleLog(med.medId, med.scheduledTime)}
                  disabled={logMutation.isPending}
                  aria-label={`Log ${med.name} ${med.dose} as taken`}
                  className="shrink-0 rounded-md bg-[var(--color-primary-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-pressed)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-pressed)] focus:ring-offset-2 disabled:opacity-50"
                >
                  Log
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
