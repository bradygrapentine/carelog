"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatClockTime } from "@/lib/format";

type MedCardProps = {
  /** UUID of the recipient whose meds to show. Required for real data; omit to skip queries (stub/placeholder mode). */
  recipientId?: string;
  /** UUID of the org. Required for real data; omit to skip queries (stub/placeholder mode). */
  orgId?: string;
};

export function MedCard({ recipientId, orgId }: MedCardProps) {
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

  const utils = trpc.useUtils();

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
          className="text-sm font-semibold text-[var(--color-ink)]"
        >
          Medications
        </h2>
        {!isLoading && !isError && rows.length > 0 && (
          <span className="eyebrow-mono">
            {takenCount} / {rows.length} logged
          </span>
        )}
      </div>

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
          No medications tracked yet for this recipient.{" "}
          <a
            href="/medications"
            className="text-[var(--color-primary)] underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Add one in Medications →
          </a>
        </p>
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

              {!med.taken && (
                <button
                  type="button"
                  data-testid="med-log-btn"
                  onClick={() => handleLog(med.medId, med.scheduledTime)}
                  disabled={logMutation.isPending}
                  aria-label={`Log ${med.name} ${med.dose} as taken`}
                  className="shrink-0 rounded-md bg-[var(--color-primary-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-50"
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
