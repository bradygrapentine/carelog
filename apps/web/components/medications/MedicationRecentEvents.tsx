"use client";

import { trpc } from "@/lib/trpc";
import { CardContent } from "@/components/ui/card";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClipboardList } from "lucide-react";

type RecentEvent = { id: string; occurred_at: string; event_type: string; payload: Record<string, unknown> };

type Props = { medicationId: string; orgId: string };

export function MedicationRecentEvents({ medicationId, orgId }: Props) {
  const { data, isLoading } = trpc.medications.get.useQuery({
    medication_id: medicationId,
    org_id: orgId,
  });

  const events = (data?.recentEvents ?? []) as RecentEvent[];

  if (isLoading)
    return <p className="text-sm text-[var(--color-muted)] px-1">Loading…</p>;

  return (
    <TintedCard>
      <TintedCardHeader title="Recent entries" />
      <CardContent className="pt-2">
        {events.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No recent entries"
            description="Journal entries mentioning this medication will appear here."
          />
        ) : (
          <ul className="space-y-2">
            {events.map((evt) => (
              <li
                key={evt.id}
                className="text-sm text-[var(--color-ink)] line-clamp-2"
              >
                {(evt.payload?.text as string | null | undefined) ?? "—"}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </TintedCard>
  );
}
