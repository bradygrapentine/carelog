"use client";

import { trpc } from "@/lib/trpc";
import { CardContent } from "@/components/ui/card";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText } from "lucide-react";

type LinkedDoc = { id: string; display_name: string; doc_type: string; created_at: string };

type Props = { medicationId: string; orgId: string };

export function MedicationLinkedDocs({ medicationId, orgId }: Props) {
  const { data, isLoading } = trpc.medications.get.useQuery({
    medication_id: medicationId,
    org_id: orgId,
  });

  const docs = (data?.linkedDocuments ?? []) as LinkedDoc[];

  if (isLoading)
    return <p className="text-sm text-[var(--color-muted)] px-1">Loading…</p>;

  return (
    <TintedCard>
      <TintedCardHeader title="Linked documents" />
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
    </TintedCard>
  );
}
