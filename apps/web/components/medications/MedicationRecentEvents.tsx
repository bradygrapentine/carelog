"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClipboardList } from "lucide-react";

type Props = { medicationId: string };

export function MedicationRecentEvents({ medicationId }: Props) {
  const { data, isLoading } = trpc.medications.get.useQuery({
    medication_id: medicationId,
  });

  const events = data?.recentEvents ?? [];

  if (isLoading)
    return <p className="text-sm text-[var(--color-muted)] px-1">Loading…</p>;

  return (
    <Card className="shadow-sm gap-2">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Recent entries</CardTitle>
      </CardHeader>
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
                {evt.payload?.text ?? "—"}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
