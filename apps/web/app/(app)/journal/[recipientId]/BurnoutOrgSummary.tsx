"use client";

import { trpc } from "../../../../lib/trpc";
import { CardContent } from "@/components/ui/card";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";

type Props = {
  orgId: string;
  currentUserRole: string;
};

export function BurnoutOrgSummary({ orgId, currentUserRole }: Props) {
  const enabled = currentUserRole === "coordinator" && Boolean(orgId);
  const { data, isLoading } = trpc.burnout.orgSummary.useQuery(
    { org_id: orgId },
    { enabled },
  );

  if (!enabled) return null;

  return (
    <TintedCard>
      <TintedCardHeader title="Team wellbeing" />
      <CardContent className="pt-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {!isLoading && (!data || data.length === 0) && (
          <p className="text-sm text-muted-foreground">
            Not enough check-ins yet to show a summary. Individual scores are
            never shown — we need at least 3 check-ins per week before trends
            appear.
          </p>
        )}
        {!isLoading && data && data.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Aggregated averages across your team (weeks with fewer than 3
              check-ins are hidden to protect privacy).
            </p>
            <ul className="text-sm divide-y divide-[var(--color-border)]">
              {data.map((wk) => (
                <li
                  key={wk.week_stamp}
                  className="flex items-center justify-between py-2"
                >
                  <span className="font-medium">{wk.week_stamp}</span>
                  <span className="text-xs text-muted-foreground">
                    sleep {wk.avg_sleep.toFixed(1)} · stress{" "}
                    {wk.avg_stress.toFixed(1)} · support{" "}
                    {wk.avg_support.toFixed(1)} ({wk.count})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </TintedCard>
  );
}
