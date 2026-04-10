"use client";

import { trpc } from "../../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Props = {
  orgId: string;
  recipientId: string;
  currentUserRole: string;
};

type ScheduleRow = {
  id: string;
  scheduled_time: string;
  medications: { id: string; drug_name: string; dosage: string }[] | null;
};

type LogEntry = {
  medication_id: string;
  scheduled_time: string;
  action: string;
};

export function MedicationChecklist({
  orgId,
  recipientId,
  currentUserRole,
}: Props) {
  const utils = trpc.useUtils();

  const { data: schedules } = trpc.medications.listScheduled.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: !!orgId && !!recipientId },
  );

  const { data: todayLogs } = trpc.medications.todayLog.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: !!orgId && !!recipientId },
  );

  const logMutation = trpc.medications.logAdministration.useMutation({
    onSuccess: () => {
      utils.medications.listScheduled.invalidate();
      utils.medications.todayLog.invalidate();
    },
  });

  if (!schedules || schedules.length === 0) return null;

  const loggedSet = new Set<string>(
    (todayLogs ?? []).map((e: LogEntry) => e.medication_id + e.scheduled_time),
  );

  const isSupporter = currentUserRole === "supporter";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{"Today's medications"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {schedules.map((sched: ScheduleRow) => {
          const med = Array.isArray(sched.medications)
            ? sched.medications[0]
            : sched.medications;
          if (!med) return null;

          const logKey = med.id + sched.scheduled_time;
          const isLogged = loggedSet.has(logKey);
          const isPending = logMutation.isPending;
          const isDisabled = isLogged || isSupporter || isPending;

          const labelText =
            med.drug_name + " " + med.dosage + " — " + sched.scheduled_time;

          const gaveClass = isLogged
            ? "px-3 py-1 text-xs rounded-lg bg-green-100 text-green-700 opacity-50 cursor-not-allowed"
            : "px-3 py-1 text-xs rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

          const missedClass = isLogged
            ? "px-3 py-1 text-xs rounded-lg bg-[var(--color-surface)] text-muted-foreground opacity-50 cursor-not-allowed"
            : "px-3 py-1 text-xs rounded-lg bg-[var(--color-surface)] text-muted-foreground hover:bg-red-100 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

          return (
            <div
              key={sched.id}
              className="flex items-center justify-between py-1 border-b border-border last:border-0"
            >
              <span className="text-sm text-foreground/80 flex-1 min-w-0">
                {labelText}
              </span>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <button
                  type="button"
                  disabled={isDisabled}
                  className={gaveClass}
                  onClick={() => {
                    if (isDisabled) return;
                    logMutation.mutate({
                      org_id: orgId,
                      recipient_id: recipientId,
                      medication_id: med.id,
                      scheduled_time: sched.scheduled_time,
                      action: "given",
                    });
                  }}
                >
                  Gave it
                </button>
                <button
                  type="button"
                  disabled={isDisabled}
                  className={missedClass}
                  onClick={() => {
                    if (isDisabled) return;
                    logMutation.mutate({
                      org_id: orgId,
                      recipient_id: recipientId,
                      medication_id: med.id,
                      scheduled_time: sched.scheduled_time,
                      action: "missed",
                    });
                  }}
                >
                  Missed
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
