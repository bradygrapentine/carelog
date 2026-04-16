"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText } from "lucide-react";

type Props = { medicationId: string };

export function MedicationLinkedDocs({ medicationId }: Props) {
  const { data, isLoading } = trpc.medications.get.useQuery({
    medication_id: medicationId,
  });

  const docs = data?.linkedDocuments ?? [];

  if (isLoading)
    return <p className="text-sm text-[var(--color-muted)] px-1">Loading…</p>;

  return (
    <Card className="shadow-sm gap-2">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Linked documents</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents linked"
            description="Documents mentioning this medication will appear here."
          />
        ) : (
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 text-sm">
                <FileText
                  className="w-4 h-4 text-[var(--color-muted)] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-[var(--color-ink)]">
                  {doc.display_name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
